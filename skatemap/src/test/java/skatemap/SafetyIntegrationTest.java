package skatemap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.security.JwtUtil;
import skatemap.service.AiModerationService;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Blocking people and reporting comments and profiles, on a real database. */
class SafetyIntegrationTest extends AbstractIntegrationTest {

    private static final GeometryFactory GEO = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private JwtUtil jwtUtil;

    @MockBean private AiModerationService aiModerationService;

    private String alice;
    private String bob;
    private String admin;
    private Spot spot;

    @BeforeEach
    void setUp() {
        when(aiModerationService.isContentAllowed(anyString())).thenReturn(true);
        String run = UUID.randomUUID().toString().substring(0, 6);
        alice = user("alice" + run, "ROLE_USER");
        bob = user("bob" + run, "ROLE_USER");
        admin = user("admin" + run, "ROLE_ADMIN");
        spot = new Spot();
        spot.setName("Safety spot " + run);
        spot.setLocation(GEO.createPoint(new Coordinate(-3.70, 40.41)));
        spot.setSpotType(SpotType.STREET);
        spot.setDifficultyLevel(DifficultyLevel.BEGINNER);
        spot.setCreatedBy(userRepository.findByUsername(alice).orElseThrow());
        spotRepository.save(spot);
    }

    @Test
    void blockingHidesTheirCommentsEndsFollowsAndStopsNewOnes() throws Exception {
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(status().isOk());
        long commentId = comment(bob, "Spam spam spam");

        as(alice, put("/api/users/" + bob + "/block")).andExpect(status().isNoContent());
        // Twice is a no-op
        as(alice, put("/api/users/" + bob + "/block")).andExpect(status().isNoContent());

        // Alice no longer sees the comment; everyone else still does
        as(alice, get("/api/spots/" + spot.getId() + "/comments")).andExpect(jsonPath("$.items.length()").value(0));
        as(admin, get("/api/spots/" + spot.getId() + "/comments")).andExpect(jsonPath("$.items[0].id").value(commentId));

        // The follow is gone and cannot come back, from either side
        as(alice, get("/api/users/" + bob)).andExpect(jsonPath("$.followedByMe").value(false))
                .andExpect(jsonPath("$.blockedByMe").value(true));
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(status().isForbidden());
        as(bob, post("/api/users/" + alice + "/follow")).andExpect(status().isForbidden());

        as(alice, get("/api/users/me/blocks")).andExpect(jsonPath("$[0].username").value(bob));

        as(alice, delete("/api/users/" + bob + "/block")).andExpect(status().isNoContent());
        as(alice, get("/api/spots/" + spot.getId() + "/comments")).andExpect(jsonPath("$.items.length()").value(1));
        as(alice, get("/api/users/me/blocks")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void youCannotBlockYourselfAndMustBeSignedIn() throws Exception {
        as(alice, put("/api/users/" + alice + "/block")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cannot_block_self"));
        mvc.perform(put("/api/users/" + bob + "/block")).andExpect(status().isUnauthorized());
    }

    @Test
    void aBlockedUsersLikeDoesNotNotifyTheBlocker() throws Exception {
        long commentId = comment(alice, "Nice ledge");
        as(alice, put("/api/users/" + bob + "/block")).andExpect(status().isNoContent());
        as(bob, post("/api/comments/" + commentId + "/like")).andExpect(status().isOk());
        as(alice, get("/api/notifications")).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void reportsGoToTheQueueOncePerReporterAndAdminsResolveThem() throws Exception {
        long commentId = comment(bob, "Buy cheap boards at example dot com");
        String report = json.writeValueAsString(Map.of("reason", "SPAM"));

        as(alice, post("/api/comments/" + commentId + "/reports").contentType(MediaType.APPLICATION_JSON).content(report))
                .andExpect(status().isAccepted());
        as(alice, post("/api/comments/" + commentId + "/reports").contentType(MediaType.APPLICATION_JSON).content(report))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("already_reported"));
        // Not your own comment, not yourself
        as(bob, post("/api/comments/" + commentId + "/reports").contentType(MediaType.APPLICATION_JSON).content(report))
                .andExpect(status().isBadRequest());
        as(alice, post("/api/users/" + alice + "/reports").contentType(MediaType.APPLICATION_JSON).content(report))
                .andExpect(status().isBadRequest());
        as(alice, post("/api/users/" + bob + "/reports").contentType(MediaType.APPLICATION_JSON).content(report))
                .andExpect(status().isAccepted());

        // Only admins see the queue
        as(alice, get("/api/admin/content-reports")).andExpect(status().isForbidden());
        JsonNode queue = read(as(admin, get("/api/admin/content-reports")).andExpect(status().isOk()));
        long commentReport = 0;
        long userReport = 0;
        for (JsonNode item : queue) {
            if ("COMMENT".equals(item.get("targetType").asText()) && item.get("targetId").asLong() == commentId) {
                commentReport = item.get("id").asLong();
            }
            if ("USER".equals(item.get("targetType").asText()) && bob.equals(item.get("targetUser").asText())) {
                userReport = item.get("id").asLong();
            }
        }
        org.assertj.core.api.Assertions.assertThat(commentReport).isPositive();
        org.assertj.core.api.Assertions.assertThat(userReport).isPositive();

        // Removing the comment deletes it for everyone; the action must fit the report
        as(admin, post("/api/admin/content-reports/" + userReport + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"REMOVE\"}")).andExpect(status().isBadRequest());
        as(alice, post("/api/admin/content-reports/" + commentReport + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"REMOVE\"}")).andExpect(status().isForbidden());
        as(admin, post("/api/admin/content-reports/" + commentReport + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"REMOVE\"}")).andExpect(status().isNoContent());
        as(admin, get("/api/spots/" + spot.getId() + "/comments")).andExpect(jsonPath("$.items.length()").value(0));

        as(admin, post("/api/admin/content-reports/" + userReport + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"DISMISS\"}")).andExpect(status().isNoContent());
        JsonNode after = read(as(admin, get("/api/admin/content-reports")));
        for (JsonNode item : after) {
            org.assertj.core.api.Assertions.assertThat(item.get("id").asLong()).isNotIn(commentReport, userReport);
        }
    }

    // --- helpers ---

    private String user(String name, String role) {
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@example.com");
        u.setPassword("not-a-real-hash");
        u.setRole(role);
        userRepository.save(u);
        return name;
    }

    private long comment(String author, String text) throws Exception {
        String body = json.writeValueAsString(Map.of("content", text));
        return read(as(author, post("/api/comments/" + spot.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())).get("id").asLong();
    }

    private ResultActions as(String username, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + jwtUtil.generateJwtToken(username)));
    }

    private JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
