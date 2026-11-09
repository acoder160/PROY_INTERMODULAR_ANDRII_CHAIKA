package spotcheck.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import spotcheck.dto.LoginRequest;
import spotcheck.entity.User;
import spotcheck.repository.UserRepository;
import spotcheck.security.JwtUtil;
import spotcheck.security.UserDetailsServiceImpl;
import spotcheck.security.ClientIpResolver;
import spotcheck.service.GoogleAuthService;
import spotcheck.service.GoogleBrowserFlowService;
import spotcheck.service.RateLimitingService;
import spotcheck.service.RefreshTokenService;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AuthController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
@org.springframework.test.context.TestPropertySource(properties = {
        "cors.allowed.origins=http://localhost:5173",
        "spotcheck.app.jwtSecret=test-secret-test-secret-test-secret-test-secret",
        "spotcheck.app.jwtExpirationMs=900000",
        "spotcheck.app.refreshExpirationMs=86400000",
        "app.rate-limit.enabled=false"
})
class AuthControllerRefreshIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthenticationManager authenticationManager;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private RefreshTokenService refreshTokenService;

    @MockBean
    private UserDetailsServiceImpl userDetailsService;

    @MockBean
    private RateLimitingService rateLimitingService;

    @MockBean
    private ClientIpResolver clientIpResolver;

    @MockBean
    private GoogleAuthService googleAuthService;

    @MockBean
    private GoogleBrowserFlowService googleBrowserFlowService;

    @Test
    void loginSetsRefreshCookieForWebClient() throws Exception {
        User user = user("skater");
        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("skater")
                .password("encoded")
                .roles("USER")
                .build();
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(details);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findByUsername("skater")).thenReturn(Optional.of(user));
        when(jwtUtil.generateJwtToken(authentication)).thenReturn("access-token");
        when(refreshTokenService.createSession(user))
                .thenReturn(new RefreshTokenService.IssuedRefreshToken("web-refresh", user));
        when(refreshTokenService.createCookie("web-refresh"))
                .thenReturn(org.springframework.http.ResponseCookie.from("spotcheck_refresh", "web-refresh")
                        .httpOnly(true).path("/api/auth").build());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest())))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("spotcheck_refresh=web-refresh")))
                .andExpect(jsonPath("$.token").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void loginReturnsRefreshTokenForMobileClient() throws Exception {
        User user = user("skater");
        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("skater")
                .password("encoded")
                .roles("USER")
                .build();
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(details);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findByUsername("skater")).thenReturn(Optional.of(user));
        when(jwtUtil.generateJwtToken(authentication)).thenReturn("access-token");
        when(refreshTokenService.createSession(user))
                .thenReturn(new RefreshTokenService.IssuedRefreshToken("mobile-refresh", user));

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Client-Type", "mobile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").value("mobile-refresh"));
    }

    @Test
    void refreshAcceptsMobileBodyAndReturnsRotatedToken() throws Exception {
        User user = user("skater");
        when(refreshTokenService.rotate("old-refresh"))
                .thenReturn(new RefreshTokenService.IssuedRefreshToken("new-refresh", user));
        when(jwtUtil.generateJwtToken("skater")).thenReturn("new-access");

        mockMvc.perform(post("/api/auth/refresh")
                        .header("X-Client-Type", "mobile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"old-refresh\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh"));
        verify(refreshTokenService).rotate("old-refresh");
    }

    @Test
    void refreshAcceptsWebCookieAndDoesNotExposeRotatedToken() throws Exception {
        User user = user("skater");
        when(refreshTokenService.rotate("cookie-refresh"))
                .thenReturn(new RefreshTokenService.IssuedRefreshToken("rotated-refresh", user));
        when(jwtUtil.generateJwtToken("skater")).thenReturn("new-access");
        when(refreshTokenService.createCookie("rotated-refresh"))
                .thenReturn(org.springframework.http.ResponseCookie.from("spotcheck_refresh", "rotated-refresh")
                        .httpOnly(true).path("/api/auth").build());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("spotcheck_refresh", "cookie-refresh")))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("rotated-refresh")))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void mobileHeaderCannotTurnCookieRefreshIntoJsonToken() throws Exception {
        User user = user("skater");
        when(refreshTokenService.rotate("cookie-refresh"))
                .thenReturn(new RefreshTokenService.IssuedRefreshToken("rotated-refresh", user));
        when(jwtUtil.generateJwtToken("skater")).thenReturn("new-access");
        when(refreshTokenService.createCookie("rotated-refresh"))
                .thenReturn(org.springframework.http.ResponseCookie.from("spotcheck_refresh", "rotated-refresh")
                        .httpOnly(true).path("/api/auth").build());

        mockMvc.perform(post("/api/auth/refresh")
                        .header("X-Client-Type", "mobile")
                        .cookie(new jakarta.servlet.http.Cookie("spotcheck_refresh", "cookie-refresh")))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("rotated-refresh")))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void logoutAcceptsMobileBodyAndClearsCookie() throws Exception {
        when(refreshTokenService.clearCookie())
                .thenReturn(org.springframework.http.ResponseCookie.from("spotcheck_refresh", "")
                        .httpOnly(true).path("/api/auth").maxAge(0).build());

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"mobile-refresh\"}"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("spotcheck_refresh=")));

        verify(refreshTokenService).revoke("mobile-refresh");
    }

    @Test
    void invalidRefreshReturnsUnauthorizedAndClearsCookie() throws Exception {
        when(refreshTokenService.rotate("invalid"))
                .thenThrow(new IllegalArgumentException("Invalid refresh token"));
        when(refreshTokenService.clearCookie())
                .thenReturn(org.springframework.http.ResponseCookie.from("spotcheck_refresh", "")
                        .httpOnly(true).path("/api/auth").maxAge(0).build());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"invalid\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("spotcheck_refresh=")));
    }

    @Test
    void googleCallbackServesReturnPageInsteadOfRedirect() throws Exception {
        when(googleBrowserFlowService.handleCallback("g-code", "state", null))
                .thenReturn("spotcheckmobile://auth/google?code=one-time");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/auth/google/callback").param("code", "g-code").param("state", "state"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "href=\"spotcheckmobile://auth/google?code=one-time\"")));
    }

    @Test
    void googleCallbackWithBadStateIsRejected() throws Exception {
        when(googleBrowserFlowService.handleCallback(any(), any(), any()))
                .thenThrow(new GoogleBrowserFlowService.BrowserFlowException("Invalid or expired state"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/auth/google/callback").param("code", "g-code").param("state", "forged"))
                .andExpect(status().isBadRequest());
    }

    private User user(String username) {
        User user = new User();
        user.setId(7L);
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setPassword("encoded");
        user.setTokenVersion(0L);
        return user;
    }

    private LoginRequest loginRequest() {
        LoginRequest request = new LoginRequest();
        request.setUsername("skater");
        request.setPassword("password");
        return request;
    }
}
