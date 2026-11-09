package spotcheck.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spotcheck.entity.User;
import spotcheck.repository.UserRepository;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * "Sign in with Google": verifies the ID token (signature, issuer, expiry and audience) and returns
 * the SpotCheck user with that email, creating one if needed.
 */
@Service
public class GoogleAuthService {

    /** The token is not valid for this app. */
    public static class InvalidGoogleTokenException extends RuntimeException {
        public InvalidGoogleTokenException(String message) { super(message); }
    }

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final GoogleIdTokenVerifier verifier;

    @Autowired
    public GoogleAuthService(UserRepository userRepository,
                             PasswordEncoder encoder,
                             @Value("${google.client-ids:}") String clientIdsProperty) {
        this(userRepository, encoder, buildVerifier(clientIdsProperty));
    }

    /** For tests: inject a verifier (null = not configured). */
    GoogleAuthService(UserRepository userRepository, PasswordEncoder encoder, GoogleIdTokenVerifier verifier) {
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.verifier = verifier;
    }

    /** Accepted OAuth client IDs, comma separated (the web client first). */
    private static GoogleIdTokenVerifier buildVerifier(String clientIdsProperty) {
        List<String> clientIds = Arrays.stream(clientIdsProperty.split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .toList();
        return clientIds.isEmpty() ? null
                : new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                        .setAudience(clientIds)
                        .build();
    }

    public boolean isConfigured() {
        return verifier != null;
    }

    @Transactional
    public User authenticate(String idTokenString) {
        GoogleIdToken.Payload payload = verify(idTokenString);

        String email = payload.getEmail();
        if (email == null || !Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new InvalidGoogleTokenException("Google account email is not verified");
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        return userRepository.findByEmail(normalizedEmail)
                .or(() -> userRepository.findByEmail(email))
                .orElseGet(() -> createUser(normalizedEmail, (String) payload.get("name")));
    }

    private GoogleIdToken.Payload verify(String idTokenString) {
        try {
            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                throw new InvalidGoogleTokenException("Invalid Google ID token");
            }
            return idToken.getPayload();
        } catch (InvalidGoogleTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidGoogleTokenException("Could not verify Google ID token");
        }
    }

    private User createUser(String email, String displayName) {
        User user = new User();
        user.setUsername(uniqueUsername(displayName, email));
        user.setEmail(email);
        // Google account: a random password nobody knows (sign-in is always through Google)
        user.setPassword(encoder.encode(UUID.randomUUID().toString() + UUID.randomUUID()));
        return userRepository.save(user);
    }

    /** Readable, unique username (max 50 chars) from the Google display name or the email. */
    private String uniqueUsername(String displayName, String email) {
        String source = (displayName != null && !displayName.isBlank()) ? displayName : email.substring(0, email.indexOf('@'));
        String base = Normalizer.normalize(source, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.length() < 3) base = "skater";
        if (base.length() > 40) base = base.substring(0, 40);

        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            suffix++;
            candidate = base + suffix;
        }
        return candidate;
    }
}
