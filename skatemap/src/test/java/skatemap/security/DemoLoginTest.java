package skatemap.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import skatemap.config.CorsConfig;
import skatemap.controller.AuthController;
import skatemap.controller.CommentController;
import skatemap.entity.User;
import skatemap.repository.UserRepository;
import skatemap.service.GoogleAuthService;
import skatemap.service.GoogleBrowserFlowService;
import skatemap.service.RateLimitingService;
import skatemap.service.RefreshTokenService;
import skatemap.service.SpotService;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The shared demo account: how visitors get in, and what keeps one visitor from spoiling it. */
@WebMvcTest(controllers = {AuthController.class, CommentController.class})
@Import({SecurityConfig.class, CorsConfig.class, ClientIpResolver.class, RateLimitingService.class})
@TestPropertySource(properties = {
        "cors.allowed.origins=http://localhost:5173",
        "skatemap.app.jwtSecret=test-secret-test-secret-test-secret-test-secret-test-secret-test-secret",
        "skatemap.app.jwtExpirationMs=900000",
        "skatemap.app.refreshExpirationMs=86400000",
        "app.client-ip-header=X-Forwarded-For",
        "app.demo.enabled=true",
        "app.demo.username=demo"
})
class DemoLoginTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private AuthenticationManager authenticationManager;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserDetailsServiceImpl userDetailsService;
    @MockBean private RefreshTokenService refreshTokenService;
    @MockBean private GoogleAuthService googleAuthService;
    @MockBean private GoogleBrowserFlowService googleBrowserFlowService;
    @MockBean private SpotService spotService;
    @MockBean private skatemap.service.CommentService commentService;

    private User demo;

    @BeforeEach
    void setUp() {
        demo = new User();
        demo.setUsername("demo");
        demo.setEmail("demo@skatemap.invalid");
        when(userRepository.findByUsername("demo")).thenReturn(Optional.of(demo));
        when(jwtUtil.generateJwtToken("demo")).thenReturn("demo-access-token");
        when(refreshTokenService.createSession(any())).thenReturn(new RefreshTokenService.IssuedRefreshToken("raw", demo));
    }

    @Test
    void demoLoginReturnsANormalSession() throws Exception {
        mockMvc.perform(post("/api/auth/demo").header("X-Client-Type", "mobile").header("X-Forwarded-For", "10.1.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("demo-access-token"))
                .andExpect(jsonPath("$.username").value("demo"));
    }

    @Test
    void demoLoginIsRateLimitedPerIp() throws Exception {
        for (int i = 0; i < 10; i++) {
            demoLogin("10.1.0.2").andExpect(status().isOk());
        }
        demoLogin("10.1.0.2").andExpect(status().isTooManyRequests());
        demoLogin("10.1.0.3").andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "demo")
    void demoCannotSignOutEveryone() throws Exception {
        mockMvc.perform(post("/api/auth/logout-all"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("demo_readonly"));
        verify(refreshTokenService, never()).revokeAll(any());
    }

    @Test
    @WithMockUser(username = "demo")
    void demoCommentBudgetIsSplitPerVisitor() throws Exception {
        for (int i = 0; i < 3; i++) {
            comment("10.1.0.4").andExpect(status().isOk());
        }
        comment("10.1.0.4").andExpect(status().isTooManyRequests());
        // Another visitor on the same shared account still has their own budget
        comment("10.1.0.5").andExpect(status().isOk());
    }

    private ResultActions demoLogin(String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/demo").header("X-Client-Type", "mobile").header("X-Forwarded-For", ip));
    }

    private ResultActions comment(String ip) throws Exception {
        return mockMvc.perform(post("/api/comments/1")
                .header("X-Forwarded-For", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Nice ledge\"}"));
    }
}
