package skatemap.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.entity.RefreshSession;
import skatemap.entity.User;
import skatemap.repository.RefreshSessionRepository;
import skatemap.repository.UserRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class RefreshTokenService {

    public static final String COOKIE_NAME = "skatemap_refresh";

    private final RefreshSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${skatemap.app.refreshExpirationMs}")
    private long refreshExpirationMs;

    @Value("${skatemap.app.refreshCookieSecure:true}")
    private boolean secureCookie;

    @Value("${skatemap.app.refreshCookieSameSite:Strict}")
    private String sameSite;

    public RefreshTokenService(RefreshSessionRepository sessionRepository, UserRepository userRepository) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public IssuedRefreshToken createSession(User user) {
        return createSession(user, UUID.randomUUID());
    }

    @Transactional
    public IssuedRefreshToken rotate(String rawToken) {
        RefreshSession current = sessionRepository.findByTokenHashForUpdate(hash(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (current.getRevokedAt() != null || current.getExpiresAt().isBefore(LocalDateTime.now())) {
            revokeFamily(current.getFamilyId(), true);
            throw new IllegalArgumentException("Refresh token was revoked or expired");
        }

        current.setRevokedAt(LocalDateTime.now());
        sessionRepository.save(current);
        return createSession(current.getUser(), current.getFamilyId());
    }

    @Transactional
    public void revoke(String rawToken) {
        sessionRepository.findByTokenHashForUpdate(hash(rawToken)).ifPresent(session -> {
            session.setRevokedAt(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    @Transactional
    public void revokeAll(User user) {
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        sessionRepository.findByUserId(user.getId()).forEach(session -> {
            if (session.getRevokedAt() == null) {
                session.setRevokedAt(LocalDateTime.now());
            }
        });
    }

    public ResponseCookie createCookie(String rawToken) {
        return ResponseCookie.from(COOKIE_NAME, rawToken)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite(sameSite)
                .path("/api/auth")
                .maxAge(Duration.ofMillis(refreshExpirationMs))
                .build();
    }

    public ResponseCookie clearCookie() {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite(sameSite)
                .path("/api/auth")
                .maxAge(Duration.ZERO)
                .build();
    }

    private IssuedRefreshToken createSession(User user, UUID familyId) {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshSession session = new RefreshSession();
        session.setUser(user);
        session.setTokenHash(hash(rawToken));
        session.setFamilyId(familyId);
        session.setExpiresAt(LocalDateTime.now().plus(Duration.ofMillis(refreshExpirationMs)));
        sessionRepository.save(session);
        return new IssuedRefreshToken(rawToken, user);
    }

    private void revokeFamily(UUID familyId, boolean reuseDetected) {
        sessionRepository.findByFamilyId(familyId).forEach(session -> {
            session.setRevokedAt(LocalDateTime.now());
            session.setReuseDetected(reuseDetected);
        });
    }

    private String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record IssuedRefreshToken(String rawToken, User user) {}
}
