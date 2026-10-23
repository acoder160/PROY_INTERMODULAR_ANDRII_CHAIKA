package skatemap.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import skatemap.entity.RefreshSession;
import skatemap.entity.User;
import skatemap.repository.RefreshSessionRepository;
import skatemap.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshSessionRepository sessionRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationMs", 86_400_000L);
        ReflectionTestUtils.setField(refreshTokenService, "secureCookie", true);
        ReflectionTestUtils.setField(refreshTokenService, "sameSite", "Strict");
    }

    @Test
    void createSessionStoresOnlyAHashAndReturnsRawToken() {
        User user = user();

        RefreshTokenService.IssuedRefreshToken issued = refreshTokenService.createSession(user);

        assertNotNull(issued.rawToken());
        assertEquals(user, issued.user());
        assertNotEquals(issued.rawToken(), sessionRepositoryArgument().getTokenHash());
        assertEquals(64, sessionRepositoryArgument().getTokenHash().length());
        verify(sessionRepository).save(any(RefreshSession.class));
    }

    @Test
    void rotateRevokesOldSessionAndKeepsFamily() {
        User user = user();
        UUID familyId = UUID.randomUUID();
        RefreshSession current = activeSession(user, familyId);
        when(sessionRepository.findByTokenHashForUpdate(any())).thenReturn(Optional.of(current));

        RefreshTokenService.IssuedRefreshToken rotated = refreshTokenService.rotate("old-token");

        assertEquals(user, rotated.user());
        assertNotNull(current.getRevokedAt());
        assertEquals(familyId, savedSessionFamily());
        verify(sessionRepository, atLeast(2)).save(any(RefreshSession.class));
    }

    @Test
    void reusingRevokedTokenRevokesEntireFamilyAndMarksReuse() {
        User user = user();
        UUID familyId = UUID.randomUUID();
        RefreshSession current = activeSession(user, familyId);
        current.setRevokedAt(LocalDateTime.now().minusMinutes(1));
        RefreshSession sibling = activeSession(user, familyId);
        when(sessionRepository.findByTokenHashForUpdate(any())).thenReturn(Optional.of(current));
        when(sessionRepository.findByFamilyId(familyId)).thenReturn(List.of(current, sibling));

        assertThrows(IllegalArgumentException.class, () -> refreshTokenService.rotate("reused-token"));

        assertTrue(current.isReuseDetected());
        assertTrue(sibling.isReuseDetected());
        assertNotNull(current.getRevokedAt());
        assertNotNull(sibling.getRevokedAt());
    }

    @Test
    void expiredTokenRevokesItsFamilyAndIsRejected() {
        User user = user();
        UUID familyId = UUID.randomUUID();
        RefreshSession expired = activeSession(user, familyId);
        expired.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        RefreshSession sibling = activeSession(user, familyId);
        when(sessionRepository.findByTokenHashForUpdate(any())).thenReturn(Optional.of(expired));
        when(sessionRepository.findByFamilyId(familyId)).thenReturn(List.of(expired, sibling));

        assertThrows(IllegalArgumentException.class, () -> refreshTokenService.rotate("expired-token"));

        assertTrue(expired.isReuseDetected());
        assertTrue(sibling.isReuseDetected());
        assertNotNull(expired.getRevokedAt());
        assertNotNull(sibling.getRevokedAt());
    }

    @Test
    void revokeAllIncrementsTokenVersionAndRevokesActiveSessions() {
        User user = user();
        RefreshSession active = activeSession(user, UUID.randomUUID());
        RefreshSession revoked = activeSession(user, UUID.randomUUID());
        revoked.setRevokedAt(LocalDateTime.now().minusMinutes(1));
        when(sessionRepository.findByUserId(user.getId())).thenReturn(List.of(active, revoked));

        refreshTokenService.revokeAll(user);

        assertEquals(1L, user.getTokenVersion());
        assertNotNull(active.getRevokedAt());
        verify(userRepository).save(user);
    }

    private User user() {
        User user = new User();
        user.setId(11L);
        user.setUsername("skater");
        user.setTokenVersion(0L);
        return user;
    }

    private RefreshSession activeSession(User user, UUID familyId) {
        RefreshSession session = new RefreshSession();
        session.setUser(user);
        session.setFamilyId(familyId);
        session.setTokenHash("a".repeat(64));
        session.setExpiresAt(LocalDateTime.now().plusHours(1));
        return session;
    }

    private RefreshSession sessionRepositoryArgument() {
        var captor = org.mockito.ArgumentCaptor.forClass(RefreshSession.class);
        verify(sessionRepository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    private UUID savedSessionFamily() {
        var captor = org.mockito.ArgumentCaptor.forClass(RefreshSession.class);
        verify(sessionRepository, atLeast(2)).save(captor.capture());
        return captor.getAllValues().get(0).getFamilyId();
    }
}
