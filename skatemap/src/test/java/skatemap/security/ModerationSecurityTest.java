package skatemap.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import skatemap.config.CorsConfig;
import skatemap.controller.AdminModerationController;
import skatemap.controller.ReportController;
import skatemap.dto.ModerationItemDto;
import skatemap.repository.UserRepository;
import skatemap.service.AdminModerationService;
import skatemap.service.RateLimitingService;
import skatemap.service.ReportService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Reports need a login and are rate limited; the moderation API is for admins only. */
@WebMvcTest(controllers = {ReportController.class, AdminModerationController.class})
@Import({SecurityConfig.class, CorsConfig.class, ClientIpResolver.class, RateLimitingService.class})
@TestPropertySource(properties = {
        "cors.allowed.origins=http://localhost:5173",
        "skatemap.app.jwtSecret=test-secret-test-secret-test-secret-test-secret-test-secret-test-secret",
        "skatemap.app.jwtExpirationMs=900000",
        "app.client-ip-header=X-Forwarded-For"
})
class ModerationSecurityTest {

    private static final String REPORT = "{\"reason\":\"SPAM\",\"comment\":\"Sells boards\"}";

    @Autowired private MockMvc mockMvc;

    @MockBean private UserRepository userRepository;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserDetailsServiceImpl userDetailsService;
    @MockBean private ReportService reportService;
    @MockBean private AdminModerationService adminModerationService;

    @Test
    void reportingNeedsALogin() throws Exception {
        mockMvc.perform(post("/api/spots/5/reports").contentType(MediaType.APPLICATION_JSON).content(REPORT))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(reportService);
    }

    @Test
    @WithMockUser(username = "skater")
    void loggedInUserCanReport() throws Exception {
        mockMvc.perform(post("/api/spots/5/reports").contentType(MediaType.APPLICATION_JSON).content(REPORT))
                .andExpect(status().isAccepted());
        verify(reportService).submit(eq(5L), eq("skater"), any(), eq("Sells boards"));
    }

    @Test
    @WithMockUser(username = "skater")
    void reportWithoutReasonIsRejected() throws Exception {
        mockMvc.perform(post("/api/spots/5/reports").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "spammer")
    void reportsAreRateLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/spots/" + i + "/reports").contentType(MediaType.APPLICATION_JSON).content(REPORT))
                    .andExpect(status().isAccepted());
        }
        mockMvc.perform(post("/api/spots/9/reports").contentType(MediaType.APPLICATION_JSON).content(REPORT))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void moderationQueueNeedsALogin() throws Exception {
        mockMvc.perform(get("/api/admin/moderation")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "skater")
    void regularUsersCannotModerate() throws Exception {
        mockMvc.perform(get("/api/admin/moderation")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/spots/5/keep")).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/comments/3")).andExpect(status().isForbidden());
        verifyNoInteractions(adminModerationService);
    }

    @Test
    @WithMockUser(username = "boss", roles = "ADMIN")
    void adminsSeeTheQueueAndDecide() throws Exception {
        when(adminModerationService.queue(any(), anyInt(), anyInt()))
                .thenReturn(new ModerationItemDto.Page(List.of(), 0, 0, 0));
        mockMvc.perform(get("/api/admin/moderation").param("filter", "NEW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
        mockMvc.perform(post("/api/admin/spots/5/keep")).andExpect(status().isNoContent());
        verify(adminModerationService).keep(5L, "boss");
        mockMvc.perform(post("/api/admin/spots/5/photo").contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"nope\"}"))
                .andExpect(status().isBadRequest());
    }
}
