package spotcheck.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import spotcheck.entity.User;
import spotcheck.repository.UserRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class GoogleAuthServiceTest {

    private UserRepository users;
    private GoogleIdTokenVerifier verifier;
    private GoogleAuthService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        verifier = mock(GoogleIdTokenVerifier.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(anyString())).thenReturn("encoded");
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        service = new GoogleAuthService(users, encoder, verifier);
    }

    @Test
    void unverifiedEmailIsRejected() throws Exception {
        token("good", "skater@gmail.com", false, "Skater");
        assertThrows(GoogleAuthService.InvalidGoogleTokenException.class, () -> service.authenticate("good"));
        verify(users, never()).save(any());
    }

    @Test
    void invalidTokenIsRejected() throws Exception {
        when(verifier.verify("forged")).thenReturn(null);
        assertThrows(GoogleAuthService.InvalidGoogleTokenException.class, () -> service.authenticate("forged"));
    }

    @Test
    void verifierFailureIsReportedAsInvalidToken() throws Exception {
        when(verifier.verify("boom")).thenThrow(new java.io.IOException("network down"));
        GoogleAuthService.InvalidGoogleTokenException e =
                assertThrows(GoogleAuthService.InvalidGoogleTokenException.class, () -> service.authenticate("boom"));
        assertFalse(e.getMessage().contains("network"), "internal details must not leak");
    }

    @Test
    void existingEmailLogsIntoThatAccount() throws Exception {
        User existing = new User();
        existing.setUsername("old_skater");
        existing.setEmail("skater@gmail.com");
        when(users.findByEmail("skater@gmail.com")).thenReturn(Optional.of(existing));
        token("good", "Skater@Gmail.com", true, "Skater");

        assertSame(existing, service.authenticate("good"));
        verify(users, never()).save(any());
    }

    @Test
    void newEmailCreatesUserWithReadableUniqueUsername() throws Exception {
        when(users.existsByUsername("jose_garcia")).thenReturn(true);
        token("good", "jose@gmail.com", true, "José García");

        User created = service.authenticate("good");

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertSame(saved.getValue(), created);
        assertEquals("jose_garcia2", created.getUsername());
        assertEquals("jose@gmail.com", created.getEmail());
        assertEquals("encoded", created.getPassword());
    }

    @Test
    void notConfiguredWithoutClientIds() {
        assertFalse(new GoogleAuthService(users, mock(PasswordEncoder.class), "").isConfigured());
        assertTrue(service.isConfigured());
    }

    private void token(String raw, String email, boolean verified, String name) throws Exception {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setEmail(email);
        payload.setEmailVerified(verified);
        payload.set("name", name);
        GoogleIdToken idToken = mock(GoogleIdToken.class);
        when(idToken.getPayload()).thenReturn(payload);
        when(verifier.verify(raw)).thenReturn(idToken);
    }
}
