package spotcheck.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import spotcheck.entity.User;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Login con Google por navegador (para Expo Go, donde no existe el módulo nativo).
 *
 * 1. La app abre /api/auth/google/start con su URL de vuelta y un reto PKCE.
 * 2. El backend redirige a Google; Google vuelve a /api/auth/google/callback con un "code".
 * 3. El backend canjea el code por un ID token (con el client secret), lo verifica como en /google
 *    y devuelve a la app un código de un solo uso (60 s), nunca el JWT en la URL.
 * 4. La app canjea ese código en /api/auth/google/exchange presentando el verificador PKCE.
 */
@Service
public class GoogleBrowserFlowService {

    public static class BrowserFlowException extends RuntimeException {
        public BrowserFlowException(String message) { super(message); }
    }

    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final Duration CODE_TTL = Duration.ofSeconds(60);

    private record PendingLogin(Long userId, String challenge, Instant expiresAt) {}

    private final GoogleAuthService googleAuthService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, PendingLogin> pendingLogins = new ConcurrentHashMap<>();

    private final String webClientId;
    private final String clientSecret;
    private final String callbackUrl;
    private final List<String> allowedAppRedirects;
    private final Key stateKey;

    public GoogleBrowserFlowService(
            GoogleAuthService googleAuthService,
            @Value("${google.client-ids:}") String clientIds,
            @Value("${google.client-secret:}") String clientSecret,
            @Value("${google.redirect-uri:}") String callbackUrl,
            @Value("${google.allow-expo-go:false}") boolean allowExpoGo,
            @Value("${spotcheck.app.jwtSecret}") String jwtSecret) {
        this.googleAuthService = googleAuthService;
        // El primer ID de GOOGLE_CLIENT_IDS es el cliente web: es el que hace este flujo
        this.webClientId = clientIds.split(",")[0].trim();
        this.clientSecret = clientSecret.trim();
        this.callbackUrl = callbackUrl.trim();
        this.allowedAppRedirects = new ArrayList<>(List.of("spotcheckmobile://"));
        if (allowExpoGo) {
            // Solo en desarrollo: cualquier proyecto abierto en Expo Go usa exp://
            allowedAppRedirects.add("exp://");
            allowedAppRedirects.add("exps://");
        }
        this.stateKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isConfigured() {
        return googleAuthService.isConfigured() && !webClientId.isEmpty()
                && !clientSecret.isEmpty() && !callbackUrl.isEmpty();
    }

    public boolean isAllowedAppRedirect(String appRedirect) {
        return appRedirect != null && allowedAppRedirects.stream().anyMatch(appRedirect::startsWith);
    }

    /** URL de Google a la que se manda al usuario. El "state" firmado lleva la vuelta a la app y el reto PKCE. */
    public String buildGoogleAuthUrl(String appRedirect, String challenge) {
        if (!isAllowedAppRedirect(appRedirect)) {
            throw new BrowserFlowException("Redirect not allowed");
        }
        if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) {
            throw new BrowserFlowException("Invalid PKCE challenge");
        }
        String state = Jwts.builder()
                .claim("r", appRedirect)
                .claim("c", challenge)
                .setExpiration(Date.from(Instant.now().plus(STATE_TTL)))
                .signWith(stateKey, SignatureAlgorithm.HS256)
                .compact();
        return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", webClientId)
                .queryParam("redirect_uri", callbackUrl)
                .queryParam("response_type", "code")
                .queryParam("scope", "openid email profile")
                .queryParam("prompt", "select_account")
                .queryParam("state", state)
                .encode()
                .build()
                .toUriString();
    }

    /** Vuelta desde Google. Devuelve la URL de la app (con ?code=... o ?error=...) a la que redirigir. */
    public String handleCallback(String googleCode, String state, String googleError) {
        Claims claims;
        try {
            claims = Jwts.parserBuilder().setSigningKey(stateKey).build().parseClaimsJws(state).getBody();
        } catch (JwtException | IllegalArgumentException e) {
            // Sin state válido no sabemos a qué app volver: no redirigimos a ningún sitio
            throw new BrowserFlowException("Invalid or expired state");
        }
        String appRedirect = claims.get("r", String.class);
        String challenge = claims.get("c", String.class);
        if (!isAllowedAppRedirect(appRedirect)) {
            throw new BrowserFlowException("Redirect not allowed");
        }
        if (googleError != null || googleCode == null) {
            return withParam(appRedirect, "error", googleError != null ? googleError : "missing_code");
        }
        try {
            User user = googleAuthService.authenticate(exchangeGoogleCode(googleCode));
            cleanupExpired();
            String oneTimeCode = randomToken(32);
            pendingLogins.put(oneTimeCode, new PendingLogin(user.getId(), challenge, Instant.now().plus(CODE_TTL)));
            return withParam(appRedirect, "code", oneTimeCode);
        } catch (RuntimeException e) {
            return withParam(appRedirect, "error", "google_failed");
        }
    }

    /** Canje del código de un solo uso. Devuelve el ID del usuario si el verificador PKCE coincide. */
    public Long exchange(String oneTimeCode, String verifier) {
        PendingLogin pending = oneTimeCode == null ? null : pendingLogins.remove(oneTimeCode);
        if (pending == null || pending.expiresAt().isBefore(Instant.now())) {
            throw new BrowserFlowException("Invalid or expired code");
        }
        if (verifier == null || !MessageDigest.isEqual(
                s256(verifier).getBytes(StandardCharsets.US_ASCII),
                pending.challenge().getBytes(StandardCharsets.US_ASCII))) {
            throw new BrowserFlowException("PKCE verification failed");
        }
        return pending.userId();
    }

    private String exchangeGoogleCode(String googleCode) {
        String form = "code=" + enc(googleCode)
                + "&client_id=" + enc(webClientId)
                + "&client_secret=" + enc(clientSecret)
                + "&redirect_uri=" + enc(callbackUrl)
                + "&grant_type=authorization_code";
        try {
            HttpResponse<String> response = http.send(
                    HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
                            .timeout(Duration.ofSeconds(15))
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .POST(HttpRequest.BodyPublishers.ofString(form))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            JsonNode body = objectMapper.readTree(response.body());
            if (response.statusCode() != 200 || !body.hasNonNull("id_token")) {
                throw new BrowserFlowException("Google token exchange failed");
            }
            return body.get("id_token").asText();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BrowserFlowException("Google token exchange interrupted");
        } catch (java.io.IOException e) {
            throw new BrowserFlowException("Google token exchange failed");
        }
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        pendingLogins.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private String randomToken(int bytes) {
        byte[] buffer = new byte[bytes];
        random.nextBytes(buffer);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
    }

    static String s256(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String withParam(String url, String key, String value) {
        return url + (url.contains("?") ? "&" : "?") + key + "=" + enc(value);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
