package skatemap.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import skatemap.config.CorsConfig;
import skatemap.controller.AuthController;
import skatemap.controller.CommentController;
import skatemap.controller.SpotController;
import skatemap.repository.UserRepository;
import skatemap.service.GoogleAuthService;
import skatemap.service.GoogleBrowserFlowService;
import skatemap.service.RateLimitingService;
import skatemap.service.RefreshTokenService;
import skatemap.service.SpotService;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Runs the real security filter chain, rate limiter and exception handler (filters are NOT
 * disabled), with the persistence and external services mocked out.
 */
@WebMvcTest(controllers = {AuthController.class, SpotController.class, CommentController.class})
@Import({SecurityConfig.class, CorsConfig.class, ClientIpResolver.class, RateLimitingService.class})
@TestPropertySource(properties = {
        "cors.allowed.origins=http://localhost:5173",
        "skatemap.app.jwtSecret=test-secret-test-secret-test-secret-test-secret-test-secret-test-secret",
        "skatemap.app.jwtExpirationMs=900000",
        "skatemap.app.refreshExpirationMs=86400000",
        "app.client-ip-header=X-Forwarded-For",
        "cloudinary.cloud-name=demo"
})
class ApiSecurityTest {

    private static final String LOGIN_BODY = "{\"username\":\"skater\",\"password\":\"wrong-password\"}";
    private static final String VALID_SPOT = "{\"name\":\"Plaza\",\"latitude\":40.4,\"longitude\":-3.7,"
            + "\"spotType\":\"STREET\",\"difficultyLevel\":\"BEGINNER\"}";

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

    @Test
    void writeWithoutTokenReturns401SoClientsRefresh() throws Exception {
        mockMvc.perform(post("/api/spots").contentType(MediaType.APPLICATION_JSON).content(VALID_SPOT))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void demoLoginIsOffUnlessEnabled() throws Exception {
        mockMvc.perform(post("/api/auth/demo").header("X-Forwarded-For", "10.0.0.9"))
                .andExpect(status().isNotFound());
    }

    @Test
    void readingSpotsIsPublic() throws Exception {
        mockMvc.perform(get("/api/spots")).andExpect(status().isOk());
    }

    @Test
    void spotListIsRevalidatedWithEtag() throws Exception {
        when(spotService.getAllSpots()).thenReturn(java.util.List.of());

        String etag = mockMvc.perform(get("/api/spots"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")))
                .andExpect(header().string("Cache-Control", not(containsString("no-store"))))
                .andExpect(header().exists("ETag"))
                .andReturn().getResponse().getHeader("ETag");

        mockMvc.perform(get("/api/spots").header("If-None-Match", etag))
                .andExpect(status().isNotModified())
                .andExpect(content().string(""));
    }

    @Test
    void badCredentialsReturn401WithGenericMessage() throws Exception {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));

        login("10.0.0.1")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void loginIsRateLimitedPerClientIp() throws Exception {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));

        for (int i = 0; i < 10; i++) {
            login("10.0.0.2").andExpect(status().isUnauthorized());
        }
        login("10.0.0.2")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.error").exists())
                .andExpect(jsonPath("$.message").exists());

        // Another client is not affected
        login("10.0.0.3").andExpect(status().isUnauthorized());
    }

    @Test
    void spoofedForwardedForEntriesDoNotBypassTheLimit() throws Exception {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));

        // Only the right-most entry (added by our proxy) counts; the rest is attacker-controlled
        for (int i = 0; i < 10; i++) {
            login("6.6.6." + i + ", 10.0.0.4").andExpect(status().isUnauthorized());
        }
        login("7.7.7.7, 10.0.0.4").andExpect(status().isTooManyRequests());
    }

    @Test
    void registerRejectsShortPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", "10.0.0.5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newskater\",\"email\":\"a@b.com\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void registerRejectsInvalidUsername() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", "10.0.0.6")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a b\",\"email\":\"a@b.com\",\"password\":\"long-enough-pass\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.username").exists());
    }

    @Test
    @WithMockUser(username = "skater")
    void spotWithInvalidCoordinatesIsRejected() throws Exception {
        String body = VALID_SPOT.replace("40.4", "123.0");
        mockMvc.perform(post("/api/spots").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.latitude").exists());
    }

    @Test
    @WithMockUser(username = "skater")
    void spotWithoutTypeIsRejected() throws Exception {
        String body = VALID_SPOT.replace(",\"spotType\":\"STREET\"", "");
        mockMvc.perform(post("/api/spots").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.spotType").exists());
    }

    @Test
    @WithMockUser(username = "skater")
    void blankCommentIsRejected() throws Exception {
        mockMvc.perform(post("/api/comments/1").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.content").exists());
    }

    @Test
    @WithMockUser(username = "spammer")
    void commentsAreRateLimitedPerUser() throws Exception {
        for (int i = 0; i < 10; i++) {
            comment().andExpect(status().isOk());
        }
        comment().andExpect(status().isTooManyRequests());
    }

    @Test
    @WithMockUser(username = "skater")
    void nonAdminCannotDeleteSomeoneElsesSpot() throws Exception {
        // Not an admin, so the controller takes the author path; the service refuses a non-author
        org.mockito.Mockito.doThrow(new skatemap.exception.ApiException(
                        org.springframework.http.HttpStatus.FORBIDDEN, "not_owner", "You can only change your own spots"))
                .when(spotService).deleteOwnSpot(1L, "skater");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/spots/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unexpectedErrorsDoNotLeakDetails() throws Exception {
        when(spotService.getAllSpots()).thenThrow(new RuntimeException("connection to db-host:5432 failed, password=hunter2"));

        mockMvc.perform(get("/api/spots"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(not(containsString("hunter2"))))
                .andExpect(content().string(not(containsString("db-host"))));
    }

    @Test
    void malformedJsonIsA400NotA500() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "10.0.0.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest());
    }

    private ResultActions login(String forwardedFor) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .header("X-Forwarded-For", forwardedFor)
                .contentType(MediaType.APPLICATION_JSON)
                .content(LOGIN_BODY));
    }

    private ResultActions comment() throws Exception {
        return mockMvc.perform(post("/api/comments/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Nice ledges\"}"));
    }
}
