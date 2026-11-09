package skatemap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.security.JwtUtil;
import skatemap.service.AiModerationService;
import skatemap.service.LiveService;
import skatemap.service.SessionService;

import java.lang.reflect.Type;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Check-ins, live counts (REST and WebSocket) and sessions on PostgreSQL + PostGIS. Runs a real
 * server port so a STOMP client can connect to /ws like the apps do.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LiveIntegrationTest extends AbstractIntegrationTest {

    private static final GeometryFactory GEO = new GeometryFactory(new PrecisionModel(), 4326);
    // MACBA, Barcelona, and a point ~40 m away / ~1.5 km away
    private static final double LAT = 41.3833, LNG = 2.1668;

    @LocalServerPort private int port;
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LiveService liveService;
    @Autowired private SessionService sessionService;
    @Autowired private SimpleBrokerMessageHandler broker;

    @MockBean private AiModerationService aiModerationService;

    private String ana;
    private String bob;
    private Spot macba;
    private Spot forum;

    @BeforeEach
    void setUp() {
        when(aiModerationService.isContentAllowed(anyString())).thenReturn(true);
        String run = UUID.randomUUID().toString().substring(0, 6);
        ana = user("ana" + run);
        bob = user("bob" + run);
        macba = spot("MACBA " + run, LAT, LNG);
        forum = spot("Forum " + run, 41.4100, 2.2270);
    }

    // --- Check-ins ---

    @Test
    void checkInOnlyWorksOnSite() throws Exception {
        checkIn(ana, macba, 41.3970, 2.1668)   // ~1.5 km north
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("checkin_too_far"));

        checkIn(ana, macba, LAT + 0.0003, LNG)  // ~35 m
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.checkedInHere").value(true))
                .andExpect(jsonPath("$.skaters[0].username").value(ana));
    }

    @Test
    void aSkaterIsAtOneSpotAtATime() throws Exception {
        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        checkIn(bob, macba, LAT, LNG).andExpect(jsonPath("$.count").value(2));
        // Checking in again at the same spot changes nothing
        checkIn(ana, macba, LAT, LNG).andExpect(jsonPath("$.count").value(2));

        checkIn(ana, forum, 41.4100, 2.2270).andExpect(status().isOk());
        assertThat(liveCount(macba)).isEqualTo(1);
        assertThat(liveCount(forum)).isEqualTo(1);

        as(bob, delete("/api/spots/" + macba.getId() + "/checkin")).andExpect(status().isNoContent());
        assertThat(liveCount(macba)).isZero();
        // The public view of a spot shows nobody there
        mvc.perform(get("/api/spots/" + macba.getId() + "/live"))
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.checkedInHere").value(false));
    }

    @Test
    void checkInsExpireAfterTheirTime() throws Exception {
        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        jdbc.update("UPDATE checkins SET expires_at = now() - interval '1 minute' WHERE spot_id = ?", macba.getId());
        // Already not counted, even before the job runs
        assertThat(liveCount(macba)).isZero();

        liveService.expireOld();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM checkins WHERE spot_id = ? AND ended_at IS NULL",
                Long.class, macba.getId())).isZero();
    }

    // --- WebSocket ---

    /** A STOMP connection to /ws that records live messages and any ERROR frame the server sends. */
    private final class Socket implements AutoCloseable {
        final BlockingQueue<Map<String, Object>> messages = new LinkedBlockingQueue<>();
        final BlockingQueue<String> errors = new LinkedBlockingQueue<>();
        final WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        StompSession session;
        final ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler(); // needed to track receipts
        Throwable connectFailure;

        Socket(String bearer) throws Exception {
            scheduler.initialize();
            client.setTaskScheduler(scheduler);
            client.setMessageConverter(new MappingJackson2MessageConverter());
            StompHeaders connect = new StompHeaders();
            if (bearer != null) connect.add("Authorization", "Bearer " + bearer);
            try {
                session = client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), connect,
                        new StompSessionHandlerAdapter() {
                            @Override public void handleFrame(StompHeaders headers, Object payload) {
                                errors.add(String.valueOf(headers.getFirst("message")));
                            }
                            @Override public void handleTransportError(StompSession s, Throwable e) {
                                errors.add(String.valueOf(e));
                            }
                        }).get(5, TimeUnit.SECONDS);
            } catch (Exception e) {
                connectFailure = e;
            }
        }

        boolean connected() { return session != null && session.isConnected(); }

        /** Subscribes and waits until the broker has registered it, so nothing is sent before it listens. */
        void subscribe(String destination) throws Exception {
            session.subscribe(destination, new StompFrameHandler() {
                @Override public Type getPayloadType(StompHeaders headers) { return Map.class; }
                @SuppressWarnings("unchecked")
                @Override public void handleFrame(StompHeaders headers, Object payload) {
                    messages.add((Map<String, Object>) payload);
                }
            });
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (!brokerHasSubscribers(destination)) {
                assertThat(System.nanoTime()).as("subscription registered at the broker").isLessThan(deadline);
                Thread.sleep(20);
            }
        }

        /** Next message for this spot (other tests share the broker, so others are skipped). */
        Map<String, Object> awaitFor(Spot spot) throws InterruptedException {
            Map<String, Object> m = messages.poll(5, TimeUnit.SECONDS);
            while (m != null && ((Number) m.get("spotId")).longValue() != spot.getId()) {
                m = messages.poll(5, TimeUnit.SECONDS);
            }
            return m;
        }

        @Override public void close() {
            try {
                if (connected()) session.disconnect();
            } catch (RuntimeException alreadyClosed) {
                // the server closes the socket itself after refusing a frame
            }
            client.stop();
            scheduler.shutdown();
        }
    }

    @Test
    void countChangesArePushedToGuests() throws Exception {
        try (Socket socket = new Socket(null)) {
            assertThat(socket.connected()).isTrue();
            socket.subscribe("/topic/live");

            checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
            Map<String, Object> message = socket.awaitFor(macba);
            assertThat(message).isNotNull();
            assertThat(((Number) message.get("count")).longValue()).isEqualTo(1);

            // Leaving pushes the drop to 0 so the badge disappears
            as(ana, delete("/api/spots/" + macba.getId() + "/checkin")).andExpect(status().isNoContent());
            message = socket.awaitFor(macba);
            assertThat(message).isNotNull();
            assertThat(((Number) message.get("count")).longValue()).isZero();
        }
    }

    @Test
    void countChangesArePushedToAClientConnectedWithAValidJwt() throws Exception {
        try (Socket socket = new Socket(jwtUtil.generateJwtToken(bob))) {
            assertThat(socket.connected()).isTrue();
            socket.subscribe("/topic/live");

            checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
            assertThat(socket.awaitFor(macba)).isNotNull();
        }
    }

    @Test
    void anInvalidJwtInTheConnectFrameIsRefused() throws Exception {
        try (Socket socket = new Socket("not-a-real-token")) {
            // Either the handshake fails or the server answers the CONNECT with an ERROR frame
            assertThat(socket.connected() && socket.errors.poll(2, TimeUnit.SECONDS) == null)
                    .as("connection with a bad token must not stay usable").isFalse();
        }
    }

    @Test
    void clientsCanOnlySubscribeToTheLiveTopic() throws Exception {
        try (Socket socket = new Socket(null)) {
            assertThat(socket.connected()).isTrue();
            socket.session.subscribe("/topic/somewhere-else", new StompSessionHandlerAdapter() {});
            assertThat(socket.errors.poll(5, TimeUnit.SECONDS)).as("ERROR frame for a foreign topic").isNotNull();
        }
    }

    // --- Followers hear about check-ins ---

    @Test
    void followersAreToldOncePerHourWhereASkaterIs() throws Exception {
        as(bob, post("/api/users/" + ana + "/follow")).andExpect(status().isOk());

        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        as(bob, get("/api/notifications"))
                .andExpect(jsonPath("$.items[0].type").value("FOLLOWEE_CHECKED_IN"))
                .andExpect(jsonPath("$.items[0].actor.username").value(ana));

        // Hopping to another spot within the hour: no second notification, no second feed line
        checkIn(ana, forum, 41.4100, 2.2270).andExpect(status().isOk());
        assertThat(countFor("notifications", "recipient_id", bob, "FOLLOWEE_CHECKED_IN")).isEqualTo(1);
        assertThat(countFor("activities", "actor_id", ana, "CHECKED_IN")).isEqualTo(1);

        // An hour later the next check-in is announced again
        jdbc.update("UPDATE activities SET created_at = now() - interval '2 hours' WHERE actor_id = "
                + "(SELECT id FROM users WHERE username = ?)", ana);
        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        assertThat(countFor("notifications", "recipient_id", bob, "FOLLOWEE_CHECKED_IN")).isEqualTo(2);
    }

    @Test
    void nonFollowersGetNothingAndSkatersAreNotNotifiedAboutThemselves() throws Exception {
        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        assertThat(countFor("notifications", "recipient_id", bob, "FOLLOWEE_CHECKED_IN")).isZero();
        assertThat(countFor("notifications", "recipient_id", ana, "FOLLOWEE_CHECKED_IN")).isZero();
    }

    @Test
    void hiddenSpotsDoNotShowUpInTheLiveCounts() throws Exception {
        checkIn(ana, macba, LAT, LNG).andExpect(status().isOk());
        jdbc.update("UPDATE spots SET status = 'HIDDEN' WHERE id = ?", macba.getId());
        String body = mvc.perform(get("/api/spots/live")).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(body).findValuesAsText("spotId")).doesNotContain(String.valueOf(macba.getId()));
    }

    @Test
    void liveEndpointsArePublicButCheckInNeedsAnAccount() throws Exception {
        mvc.perform(get("/api/spots/live")).andExpect(status().isOk());
        mvc.perform(post("/api/spots/" + macba.getId() + "/checkin").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":" + LAT + ",\"longitude\":" + LNG + "}"))
                .andExpect(status().isUnauthorized());
    }

    // --- Sessions ---

    @Test
    void sessionsCanBeJoinedAndNotifyTheHost() throws Exception {
        long id = createSession(bob, macba, Instant.now().plus(2, ChronoUnit.DAYS), "Game of SKATE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants").value(1))
                .andExpect(jsonPath("$.hostedByMe").value(true))
                .andReturn().getResponse().getContentAsString().transform(this::idOf);

        as(ana, post("/api/sessions/" + id + "/join"))
                .andExpect(jsonPath("$.participants").value(2))
                .andExpect(jsonPath("$.joinedByMe").value(true));
        as(bob, get("/api/notifications")).andExpect(jsonPath("$.items[0].type").value("SESSION_JOINED"))
                .andExpect(jsonPath("$.items[0].session.id").value(id));

        as(ana, get("/api/spots/" + macba.getId() + "/sessions"))
                .andExpect(jsonPath("$[0].note").value("Game of SKATE"))
                .andExpect(jsonPath("$[0].joinedByMe").value(true));

        as(bob, delete("/api/sessions/" + id + "/join")).andExpect(jsonPath("$.code").value("host_cannot_leave"));
        as(ana, delete("/api/sessions/" + id)).andExpect(status().isForbidden());
        as(ana, delete("/api/sessions/" + id + "/join")).andExpect(jsonPath("$.participants").value(1));
        as(bob, delete("/api/sessions/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/spots/" + macba.getId() + "/sessions")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void sessionTimesMustBeAheadAndWithinAMonth() throws Exception {
        createSession(bob, macba, Instant.now().minus(1, ChronoUnit.DAYS), null)
                .andExpect(jsonPath("$.code").value("session_bad_time"));
        createSession(bob, macba, Instant.now().plus(40, ChronoUnit.DAYS), null)
                .andExpect(jsonPath("$.code").value("session_bad_time"));
    }

    @Test
    void participantsAreRemindedOnceShortlyBeforeTheStart() throws Exception {
        long id = createSession(bob, macba, Instant.now().plus(20, ChronoUnit.MINUTES), null)
                .andReturn().getResponse().getContentAsString().transform(this::idOf);
        as(ana, post("/api/sessions/" + id + "/join")).andExpect(status().isOk());

        assertThat(sessionService.sendReminders()).isGreaterThanOrEqualTo(1);
        assertThat(sessionService.sendReminders()).isZero(); // only once

        as(ana, get("/api/notifications")).andExpect(jsonPath("$.items[0].type").value("SESSION_REMINDER"));
        // The host is reminded too
        as(bob, get("/api/notifications")).andExpect(jsonPath("$.items[0].type").value("SESSION_REMINDER"));
    }

    // --- helpers ---

    private ResultActions checkIn(String username, Spot spot, double lat, double lng) throws Exception {
        return as(username, post("/api/spots/" + spot.getId() + "/checkin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":" + lat + ",\"longitude\":" + lng + "}"));
    }

    private ResultActions createSession(String username, Spot spot, Instant startsAt, String note) throws Exception {
        String body = json.writeValueAsString(note == null
                ? Map.of("startsAt", startsAt.toString())
                : Map.of("startsAt", startsAt.toString(), "note", note));
        return as(username, post("/api/spots/" + spot.getId() + "/sessions").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private boolean brokerHasSubscribers(String destination) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setDestination(destination);
        return !broker.getSubscriptionRegistry()
                .findSubscriptions(MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders())).isEmpty();
    }

    private long countFor(String table, String userColumn, String username, String type) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " t JOIN users u ON u.id = t." + userColumn
                + " WHERE u.username = ? AND t.type = ?", Long.class, username, type);
    }

    private long liveCount(Spot spot) throws Exception {
        JsonNode node = json.readTree(mvc.perform(get("/api/spots/" + spot.getId() + "/live"))
                .andReturn().getResponse().getContentAsString());
        return node.get("count").asLong();
    }

    private long idOf(String body) {
        try {
            return json.readTree(body).get("id").asLong();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private ResultActions as(String username, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + jwtUtil.generateJwtToken(username)));
    }

    private String user(String name) {
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@example.com");
        u.setPassword("not-a-real-hash");
        userRepository.save(u);
        return name;
    }

    private Spot spot(String name, double lat, double lng) {
        Spot spot = new Spot();
        spot.setName(name);
        spot.setLocation(GEO.createPoint(new Coordinate(lng, lat)));
        spot.setSpotType(SpotType.LEDGE);
        spot.setDifficultyLevel(DifficultyLevel.INTERMEDIATE);
        spot.setCreatedBy(userRepository.findByUsername(bob).orElseThrow());
        return spotRepository.save(spot);
    }
}
