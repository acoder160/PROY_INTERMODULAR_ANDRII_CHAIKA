package spotcheck.service;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class GoogleBrowserFlowServiceTest {

    private static final String CHALLENGE = "a".repeat(43);
    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret-test-secret-xx";

    private GoogleBrowserFlowService service(boolean allowExpoGo) {
        return new GoogleBrowserFlowService(mock(GoogleAuthService.class), "web-id.apps.googleusercontent.com",
                "client-secret", "https://tunnel.example/api/auth/google/callback", allowExpoGo, SECRET);
    }

    @Test
    void appSchemeIsAlwaysAllowed() {
        String url = service(false).buildGoogleAuthUrl("spotcheckmobile://auth/google", CHALLENGE);
        assertTrue(url.startsWith("https://accounts.google.com/"));
        String query = URLDecoder.decode(URI.create(url).getRawQuery(), StandardCharsets.UTF_8);
        assertTrue(query.contains("redirect_uri=https://tunnel.example/api/auth/google/callback"), query);
    }

    @Test
    void expoGoOnlyWhenEnabled() {
        assertThrows(GoogleBrowserFlowService.BrowserFlowException.class,
                () -> service(false).buildGoogleAuthUrl("exp://192.168.1.33:8081/--/auth/google", CHALLENGE));
        assertDoesNotThrow(() -> service(true).buildGoogleAuthUrl("exp://192.168.1.33:8081/--/auth/google", CHALLENGE));
    }

    @Test
    void foreignRedirectsAreRejected() {
        for (String redirect : new String[]{"https://evil.example/", "javascript:alert(1)", "intent://x"}) {
            assertThrows(GoogleBrowserFlowService.BrowserFlowException.class,
                    () -> service(true).buildGoogleAuthUrl(redirect, CHALLENGE), redirect);
        }
    }

    @Test
    void forgedStateIsRejected() {
        assertThrows(GoogleBrowserFlowService.BrowserFlowException.class,
                () -> service(true).handleCallback("code", "not-a-signed-state", null));
    }
}
