package skatemap;

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
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.security.JwtUtil;
import skatemap.service.AiModerationService;
import skatemap.service.OpenAiCompatClient;
import skatemap.service.SpotListCache;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Duplicate detection (PostGIS + pg_trgm) and plain-words search on a real database. */
class AiIntegrationTest extends AbstractIntegrationTest {

    private static final GeometryFactory GEO = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private SpotListCache spotListCache;

    @MockBean private AiModerationService aiModerationService;
    @MockBean private OpenAiCompatClient aiClient;
    @MockBean private skatemap.service.ImageModerationService imageModerationService;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private String bob;
    private String run;
    private Spot ledge;

    private static final OpenAiCompatClient.Provider PROVIDER =
            new OpenAiCompatClient.Provider("test", "http://localhost/x", "key", "model");

    @BeforeEach
    void setUp() {
        when(aiModerationService.isContentAllowed(anyString())).thenReturn(true);
        when(aiModerationService.textProviders()).thenReturn(java.util.List.of(PROVIDER));
        run = UUID.randomUUID().toString().substring(0, 6);
        User u = new User();
        u.setUsername("bob" + run);
        u.setEmail("bob" + run + "@example.com");
        u.setPassword("not-a-real-hash");
        userRepository.save(u);
        bob = u.getUsername();
        // Somewhere no other test puts spots: Bilbao
        ledge = new Spot();
        ledge.setName("Guggenheim ledges " + run);
        ledge.setDescription("Smooth granite ledges by the river");
        ledge.setLocation(GEO.createPoint(new Coordinate(-2.9340 + Math.random() * 0.5, 43.2687)));
        ledge.setSpotType(SpotType.LEDGE);
        ledge.setDifficultyLevel(DifficultyLevel.INTERMEDIATE);
        ledge.setSurfaceRating(4.6);
        ledge.setCreatedBy(u);
        spotRepository.save(ledge);
        spotListCache.invalidate();
    }

    @Test
    void aSpotRightNextToAnExistingOneIsFlaggedAsADuplicate() throws Exception {
        double lng = ledge.getLocation().getX();
        // ~8 m away, different name: same place
        create("Totally different name", 43.26877, lng)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("duplicate_candidate"))
                .andExpect(jsonPath("$.candidate.id").value(ledge.getId().intValue()));
        // ~35 m away with a similar name: likely the same spot
        create("Guggenheim ledge " + run, 43.2690, lng)
                .andExpect(status().isConflict());
        // ~35 m away, unrelated name: a different spot
        create("Riverside rail " + run, 43.2690, lng).andExpect(status().isOk());
        // The user confirmed it's a different spot
        create("Totally different name", 43.26877, lng, true).andExpect(status().isOk());
    }

    @Test
    void searchTurnsWordsIntoFiltersAndRunsThemOnTheMap() throws Exception {
        modelAnswers("{\"types\":[\"LEDGE\"],\"difficulty\":[],\"minRating\":4,\"distanceKm\":0,\"keywords\":[\"guggenheim\"]}");
        search("best ledges at the guggenheim", null, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aiUsed").value(true))
                .andExpect(jsonPath("$.filters.types[0]").value("LEDGE"))
                .andExpect(jsonPath("$.spots[?(@.id == " + ledge.getId() + ")]").exists());
    }

    @Test
    void nearMeRunsThroughPostGisAndLeavesFarSpotsOut() throws Exception {
        modelAnswers("{\"types\":[],\"difficulty\":[],\"minRating\":0,\"distanceKm\":3,\"keywords\":[]}");
        double lat = ledge.getLocation().getY();
        double lng = ledge.getLocation().getX();
        // 1 km east of the ledge: inside 3 km
        search("ledges close to me", lat, lng + 0.0125)
                .andExpect(jsonPath("$.spots[?(@.id == " + ledge.getId() + ")]").exists());
        // ~30 km away: outside
        search("ledges close to me", lat, lng + 0.4)
                .andExpect(jsonPath("$.spots[?(@.id == " + ledge.getId() + ")]").doesNotExist());
    }

    @Test
    void searchFallsBackToKeywordsWhenNoModelAnswers() throws Exception {
        modelAnswers(null);
        search("guggenheim", null, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aiUsed").value(false))
                .andExpect(jsonPath("$.filters.keywords[0]").value("guggenheim"))
                .andExpect(jsonPath("$.spots[?(@.id == " + ledge.getId() + ")]").exists());
    }

    @Test
    void searchIsPublicButValidatesItsInput() throws Exception {
        modelAnswers(null);
        search("guggenheim", null, null).andExpect(status().isOk()); // no token
        mvc.perform(post("/api/search").contentType(MediaType.APPLICATION_JSON).content("{\"query\":\"\"}"))
                .andExpect(status().isBadRequest());
        search("guggenheim", 123.0, 0.0).andExpect(status().isBadRequest()); // latitude out of range
    }

    @Test
    void theOldGetSearchIsGone() throws Exception {
        mvc.perform(get("/api/spots/search").param("q", "guggenheim"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void tagSuggestionsNeedAnAccount() throws Exception {
        mvc.perform(post("/api/ai/suggest-tags").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaUrl\":\"https://res.cloudinary.com/demo/image/upload/skatemap_spots/u1/x.jpg\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void closeSpotsWithUnrelatedNamesAreComparedByPhoto() throws Exception {
        // The existing spot has a photo; the model says the new photo shows the same place
        jdbc.update("UPDATE spots SET media_url = ? WHERE id = ?",
                "https://res.cloudinary.com/demo/image/upload/skatemap_spots/u1/existing.jpg", ledge.getId());
        spotListCache.invalidate();
        double lng = ledge.getLocation().getX();
        when(imageModerationService.comparePhotos(anyString(), anyString()))
                .thenReturn(json.readTree("{\"sameSpot\":true,\"confidence\":0.9}"));
        createWithPhoto("Riverside rail " + run, 43.2690, lng)   // ~35 m away, unrelated name
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("duplicate_candidate"));

        // Photos say it is a different place: the spot is created
        when(imageModerationService.comparePhotos(anyString(), anyString()))
                .thenReturn(json.readTree("{\"sameSpot\":false,\"confidence\":0.9}"));
        when(imageModerationService.checkUpload(any(), any(), any()))
                .thenReturn(new skatemap.service.ImageModerationService.Verdict(
                        skatemap.service.ImageModerationService.Outcome.ALLOW, null, "ok"));
        createWithPhoto("Riverside rail " + run, 43.2690, lng).andExpect(status().isOk());
    }

    @Test
    void tagSuggestionsOnlyForYourOwnUploads() throws Exception {
        mvc.perform(post("/api/ai/suggest-tags")
                        .header("Authorization", "Bearer " + jwtUtil.generateJwtToken(bob))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaUrl\":\"https://res.cloudinary.com/demo/image/upload/skatemap_spots/u999999/x.jpg\"}"))
                .andExpect(status().isBadRequest());
    }

    private org.springframework.test.web.servlet.ResultActions search(String query, Double lat, Double lng) throws Exception {
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("query", query);
        if (lat != null) body.put("lat", lat);
        if (lng != null) body.put("lng", lng);
        return mvc.perform(post("/api/search").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private void modelAnswers(String body) throws Exception {
        when(aiClient.chatJsonSchema(any(), anyString(), any(), anyInt(), anyString(), anyMap()))
                .thenReturn(body == null ? null : json.readTree(body));
    }

    private org.springframework.test.web.servlet.ResultActions createWithPhoto(String name, double lat, double lng) throws Exception {
        String body = json.writeValueAsString(Map.of("name", name, "latitude", lat, "longitude", lng,
                "spotType", "STREET", "difficultyLevel", "BEGINNER",
                "mediaUrl", "https://res.cloudinary.com/demo/image/upload/skatemap_spots/u1/new.jpg"));
        return mvc.perform(post("/api/spots")
                .header("Authorization", "Bearer " + jwtUtil.generateJwtToken(bob))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private org.springframework.test.web.servlet.ResultActions create(String name, double lat, double lng) throws Exception {
        return create(name, lat, lng, false);
    }

    private org.springframework.test.web.servlet.ResultActions create(String name, double lat, double lng, boolean force) throws Exception {
        String body = json.writeValueAsString(Map.of("name", name, "latitude", lat, "longitude", lng,
                "spotType", "STREET", "difficultyLevel", "BEGINNER", "force", force));
        return mvc.perform(post("/api/spots")
                .header("Authorization", "Bearer " + jwtUtil.generateJwtToken(bob))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
