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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The social layer end to end on PostgreSQL + PostGIS: follows, feed paging, threads, likes,
 * notifications, ownership rules and account deletion. Only the AI text check is stubbed.
 */
class SocialIntegrationTest extends AbstractIntegrationTest {

    private static final GeometryFactory GEO = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private JwtUtil jwtUtil;

    @MockBean private AiModerationService aiModerationService;

    private String alice;
    private String bob;
    private String carol;

    @BeforeEach
    void setUp() {
        when(aiModerationService.isContentAllowed(anyString())).thenReturn(true);
        // Fresh names per test: the database is shared by the whole class
        String run = UUID.randomUUID().toString().substring(0, 6);
        alice = user("alice" + run);
        bob = user("bob" + run);
        carol = user("carol" + run);
    }

    // --- Follows ---

    @Test
    void followIsIdempotentCountedAndNotifies() throws Exception {
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true)).andExpect(jsonPath("$.followers").value(1));
        // Twice is a no-op, not an error and not a second notification
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(jsonPath("$.followers").value(1));

        as(bob, get("/api/notifications")).andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1))
                .andExpect(jsonPath("$.items[0].type").value("FOLLOW"))
                .andExpect(jsonPath("$.items[0].actor.username").value(alice));

        // Public profile, seen by alice: she follows bob
        as(alice, get("/api/users/" + bob)).andExpect(jsonPath("$.followers").value(1))
                .andExpect(jsonPath("$.followedByMe").value(true)).andExpect(jsonPath("$.me").value(false));
        mvc.perform(get("/api/users/" + bob + "/followers"))
                .andExpect(jsonPath("$[0].username").value(alice));

        as(alice, delete("/api/users/" + bob + "/follow")).andExpect(jsonPath("$.followers").value(0));
    }

    @Test
    void cannotFollowYourself() throws Exception {
        as(alice, post("/api/users/" + alice + "/follow"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cannot_follow_self"));
    }

    // --- Feed ---

    @Test
    void feedPagesWithAKeysetCursorWithoutGapsOrRepeats() throws Exception {
        Spot spot = spot(bob, "Bob ledge");
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(status().isOk());
        for (int i = 0; i < 25; i++) {
            comment(bob, spot.getId(), "line " + i, null);
        }
        // Not followed: carol's activity must not show up
        comment(carol, spot.getId(), "carol was here", null);

        JsonNode first = read(as(alice, get("/api/feed")).andExpect(status().isOk()));
        assertThat(first.get("items")).hasSize(20);
        assertThat(first.get("items").get(0).get("comment").asText()).isEqualTo("line 24");
        long cursor = first.get("nextCursor").asLong();

        JsonNode second = read(as(alice, get("/api/feed").param("before", String.valueOf(cursor))));
        assertThat(second.get("items")).hasSize(5);
        assertThat(second.get("nextCursor").isNull()).isTrue();

        Set<Long> ids = new HashSet<>();
        List<String> actors = new ArrayList<>();
        for (JsonNode page : List.of(first, second)) {
            page.get("items").forEach(item -> {
                ids.add(item.get("id").asLong());
                actors.add(item.get("actor").get("username").asText());
            });
        }
        assertThat(ids).hasSize(25);
        assertThat(actors).containsOnly(bob);
    }

    @Test
    void feedNeedsAnAccount() throws Exception {
        mvc.perform(get("/api/feed")).andExpect(status().isUnauthorized());
    }

    // --- Threads, likes, ownership ---

    @Test
    void repliesFormOneLevelThreadsAndNotifyTheRightPeople() throws Exception {
        Spot spot = spot(bob, "Bob bowl");
        long top = comment(carol, spot.getId(), "Smooth bowl", null);
        long reply = comment(alice, spot.getId(), "Agreed", top);
        // A reply to a reply joins the same thread
        long replyToReply = comment(carol, spot.getId(), "Thanks!", reply);

        JsonNode page = read(mvc.perform(get("/api/spots/" + spot.getId() + "/comments")));
        JsonNode thread = page.get("items").get(0);
        assertThat(thread.get("id").asLong()).isEqualTo(top);
        assertThat(thread.get("replies")).hasSize(2);
        assertThat(thread.get("replies").get(1).get("id").asLong()).isEqualTo(replyToReply);
        assertThat(thread.get("replies").get(1).get("parentId").asLong()).isEqualTo(top);

        // carol: alice replied to her; alice: carol replied to her. Bob, the spot owner, hears about all three.
        as(carol, get("/api/notifications")).andExpect(jsonPath("$.items[0].type").value("REPLY"));
        as(alice, get("/api/notifications")).andExpect(jsonPath("$.items[0].type").value("REPLY"));
        as(bob, get("/api/notifications")).andExpect(jsonPath("$.unread").value(3));
        as(bob, post("/api/notifications/read")).andExpect(status().isNoContent());
        as(bob, get("/api/notifications/unread-count")).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void likesAreCountedOncePerPersonAndNotifyOnce() throws Exception {
        Spot spot = spot(bob, "Bob rail");
        long id = comment(carol, spot.getId(), "Kinked rail", null);

        as(alice, post("/api/comments/" + id + "/like")).andExpect(jsonPath("$.likes").value(1));
        as(alice, post("/api/comments/" + id + "/like")).andExpect(jsonPath("$.likes").value(1));
        as(alice, delete("/api/comments/" + id + "/like")).andExpect(jsonPath("$.likes").value(0));
        as(alice, post("/api/comments/" + id + "/like")).andExpect(jsonPath("$.likes").value(1));

        as(alice, get("/api/spots/" + spot.getId() + "/comments"))
                .andExpect(jsonPath("$.items[0].likeCount").value(1))
                .andExpect(jsonPath("$.items[0].likedByMe").value(true));
        // Like, unlike, like again: still one notification
        JsonNode notes = read(as(carol, get("/api/notifications")));
        long likeNotes = 0;
        for (JsonNode n : notes.get("items")) if ("COMMENT_LIKE".equals(n.get("type").asText())) likeNotes++;
        assertThat(likeNotes).isEqualTo(1);
    }

    @Test
    void onlyTheAuthorEditsOrDeletesAndThreadsSurviveDeletion() throws Exception {
        Spot spot = spot(bob, "Bob stairs");
        long top = comment(carol, spot.getId(), "Seven stair", null);
        comment(alice, spot.getId(), "Eight actually", top);

        as(alice, patch("/api/comments/" + top).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hacked\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("not_owner"));
        as(carol, patch("/api/comments/" + top).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Eight stair\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editedAt").isNotEmpty());

        as(alice, delete("/api/comments/" + top)).andExpect(status().isForbidden());
        as(carol, delete("/api/comments/" + top)).andExpect(status().isNoContent());

        // It had a reply, so it stays as a placeholder without content or author
        mvc.perform(get("/api/spots/" + spot.getId() + "/comments"))
                .andExpect(jsonPath("$.items[0].deleted").value(true))
                .andExpect(jsonPath("$.items[0].content").doesNotExist())
                .andExpect(jsonPath("$.items[0].replies[0].content").value("Eight actually"));
    }

    @Test
    void onlyTheAuthorEditsOrDeletesTheirSpot() throws Exception {
        Spot spot = spot(bob, "Bob gap");
        String update = "{\"name\":\"Bob big gap\",\"description\":\"Watch the cars\",\"spotType\":\"STREET\",\"difficultyLevel\":\"ADVANCED\"}";

        as(alice, patch("/api/spots/" + spot.getId()).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isForbidden());
        as(bob, patch("/api/spots/" + spot.getId()).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Bob big gap"))
                .andExpect(jsonPath("$.difficultyLevel").value("ADVANCED"));

        as(alice, delete("/api/spots/" + spot.getId())).andExpect(status().isForbidden());
        comment(carol, spot.getId(), "RIP", null);
        as(alice, put("/api/favorites/" + spot.getId())).andExpect(status().isNoContent());
        // Comments, favorites, feed lines and notifications go with it (foreign keys cascade)
        as(bob, delete("/api/spots/" + spot.getId())).andExpect(status().isOk());
        mvc.perform(get("/api/spots/" + spot.getId())).andExpect(status().isNotFound());
        as(alice, get("/api/favorites")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void favoritesAreIdempotent() throws Exception {
        Spot spot = spot(bob, "Bob park");
        as(alice, put("/api/favorites/" + spot.getId())).andExpect(status().isNoContent());
        as(alice, put("/api/favorites/" + spot.getId())).andExpect(status().isNoContent());
        as(alice, get("/api/favorites")).andExpect(jsonPath("$[0]").value(spot.getId().intValue()))
                .andExpect(jsonPath("$.length()").value(1));
        as(alice, get("/api/favorites/spots")).andExpect(jsonPath("$[0].name").value("Bob park"));
        as(alice, delete("/api/favorites/" + spot.getId())).andExpect(status().isNoContent());
        as(alice, get("/api/favorites")).andExpect(jsonPath("$.length()").value(0));
    }

    // --- Account deletion ---

    @Test
    void deletingAnAccountAnonymisesItAndKillsItsSessions() throws Exception {
        Spot spot = spot(bob, "Bob hubba");
        comment(alice, spot.getId(), "Did a crooked here", null);
        as(alice, post("/api/users/" + bob + "/follow")).andExpect(status().isOk());
        String token = jwtUtil.generateJwtToken(alice);

        mvc.perform(delete("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/users/" + alice)).andExpect(status().isNotFound());
        // The old access token stops working at once (token_version bumped, name gone)
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        // The comment stays for the community, without the author
        mvc.perform(get("/api/spots/" + spot.getId() + "/comments"))
                .andExpect(jsonPath("$.items[0].authorDeleted").value(true))
                .andExpect(jsonPath("$.items[0].username").doesNotExist())
                .andExpect(jsonPath("$.items[0].content").value("Did a crooked here"));
        as(bob, get("/api/users/" + bob)).andExpect(jsonPath("$.followers").value(0));
        // And the name is free again
        assertThat(userRepository.findByUsername(alice)).isEmpty();
    }

    @Test
    void reservedUsernamesCannotBeRegistered() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"me\",\"email\":\"me@example.com\",\"password\":\"long-enough-pw\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"deleted_42\",\"email\":\"d42@example.com\",\"password\":\"long-enough-pw\"}"))
                .andExpect(status().isBadRequest());
    }

    // --- Share links ---

    @Test
    void shareLinkServesEscapedOpenGraphTags() throws Exception {
        Spot spot = spot(bob, "<script>alert(1)</script> & co");
        String html = mvc.perform(get("/s/" + spot.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(html).contains("og:title").contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co")
                .doesNotContain("<script>alert(1)");
        assertThat(html).contains("/map?spot=" + spot.getId());
    }

    @Test
    void pushTokensMustLookLikeExpoTokens() throws Exception {
        as(alice, post("/api/push-tokens").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"https://evil.example\",\"platform\":\"android\"}"))
                .andExpect(status().isBadRequest());
        as(alice, post("/api/push-tokens").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"ExponentPushToken[abcdefghij123456]\",\"platform\":\"android\",\"locale\":\"es\"}"))
                .andExpect(status().isNoContent());
    }

    // --- helpers ---

    private String user(String name) {
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@example.com");
        u.setPassword("not-a-real-hash");
        userRepository.save(u);
        return name;
    }

    private Spot spot(String owner, String name) {
        Spot spot = new Spot();
        spot.setName(name);
        spot.setLocation(GEO.createPoint(new Coordinate(-3.70, 40.41)));
        spot.setSpotType(SpotType.STREET);
        spot.setDifficultyLevel(DifficultyLevel.BEGINNER);
        spot.setCreatedBy(userRepository.findByUsername(owner).orElseThrow());
        return spotRepository.save(spot);
    }

    private long comment(String author, Long spotId, String text, Long parentId) throws Exception {
        String body = json.writeValueAsString(parentId == null
                ? java.util.Map.of("content", text)
                : java.util.Map.of("content", text, "parentId", parentId));
        return read(as(author, post("/api/comments/" + spotId).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())).get("id").asLong();
    }

    private ResultActions as(String username, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + jwtUtil.generateJwtToken(username)));
    }

    private JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
