package skatemap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import skatemap.repository.UserRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End to end on a real database: the account is seeded at startup and its session works. */
@TestPropertySource(properties = {"app.demo.enabled=true", "app.demo.username=demo"})
class DemoAccountIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void demoAccountIsSeededAndItsTokenIsAccepted() throws Exception {
        assertThat(userRepository.findByUsername("demo")).isPresent();

        String body = mockMvc.perform(post("/api/auth/demo").header("X-Client-Type", "mobile"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode session = objectMapper.readTree(body);
        assertThat(session.get("username").asText()).isEqualTo("demo");
        assertThat(session.get("refreshToken").asText()).isNotBlank();

        // The access token really authenticates: a blank comment gets past security to validation
        mockMvc.perform(post("/api/comments/1")
                        .header("Authorization", "Bearer " + session.get("token").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void demoCannotSignOutEveryone() throws Exception {
        String token = objectMapper.readTree(mockMvc.perform(post("/api/auth/demo").header("X-Client-Type", "mobile"))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/auth/logout-all").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void demoProfileCannotBeChangedOrDeleted() throws Exception {
        String token = objectMapper.readTree(mockMvc.perform(post("/api/auth/demo").header("X-Client-Type", "mobile"))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\":\"I own the demo now\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        assertThat(userRepository.findByUsername("demo")).isPresent();
    }
}
