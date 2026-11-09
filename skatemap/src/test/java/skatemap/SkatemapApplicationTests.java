package skatemap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Boots the real app on PostGIS: migrations, entity mapping (ddl-auto=validate) and the geo query. */
class SkatemapApplicationTests extends AbstractIntegrationTest {

    private static final GeometryFactory GEO = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private User author;

    @BeforeEach
    void setUp() {
        author = userRepository.findByUsername("it-author").orElseGet(() -> {
            User u = new User();
            u.setUsername("it-author");
            u.setEmail("it-author@example.com");
            u.setPassword("not-a-real-hash");
            return userRepository.save(u);
        });
    }

    @Test
    void healthEndpointIsPublicAndUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void otherActuatorEndpointsAreNotExposed() throws Exception {
        // Not exposed at all; anonymous callers get 401 before routing gets a chance to 404
        mockMvc.perform(get("/actuator/env")).andExpect(status().is4xxClientError());
    }

    @Test
    void nearbySearchUsesRealDistances() throws Exception {
        Spot near = saveSpot("Near ledge", 40.4168, -3.7038);      // Madrid, Puerta del Sol
        Spot far = saveSpot("Far park", 41.3874, 2.1686);          // Barcelona, ~500 km away

        mockMvc.perform(get("/api/spots/nearby").param("lat", "40.4170").param("lng", "-3.7040").param("dist", "1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(hasItem(near.getId().intValue())))
                .andExpect(jsonPath("$[*].id").value(not(hasItem(far.getId().intValue()))));
    }

    @Test
    void nearbySearchCanUseTheGeographyIndex() {
        // The spatial predicate of SpotRepository.findSpotIdsNearby. The index must match that exact
        // expression (CAST(location AS geography)) or PostGIS falls back to a full scan. With a
        // handful of rows the planner would rightly pick a sequential scan, so that is turned off
        // to see whether the index CAN serve the predicate. (The status filter is left out: on a
        // tiny table the planner would pick idx_spots_status instead, which proves nothing.)
        String plan = jdbcTemplate.execute((ConnectionCallback<String>) connection -> {
            try (Statement st = connection.createStatement()) {
                st.execute("SET enable_seqscan = off");
                StringBuilder out = new StringBuilder();
                try (ResultSet rs = st.executeQuery("EXPLAIN SELECT s.id FROM spots s WHERE "
                        + "ST_DWithin(CAST(s.location AS geography), "
                        + "CAST(ST_SetSRID(ST_MakePoint(-3.70, 40.41), 4326) AS geography), 1000, false)")) {
                    while (rs.next()) out.append(rs.getString(1)).append('\n');
                } finally {
                    st.execute("RESET enable_seqscan");
                }
                return out.toString();
            }
        });
        assertThat(plan).contains("idx_spots_location_geog");
    }

    private Spot saveSpot(String name, double lat, double lng) {
        Spot spot = new Spot();
        spot.setName(name);
        spot.setLocation(GEO.createPoint(new Coordinate(lng, lat)));
        spot.setSpotType(SpotType.LEDGE);
        spot.setDifficultyLevel(DifficultyLevel.BEGINNER);
        spot.setCreatedBy(author);
        return spotRepository.save(spot);
    }
}
