package skatemap.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import skatemap.entity.User;
import skatemap.repository.UserRepository;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Creates the shared demo account on startup when DEMO_ENABLED=true. Its password is random and
 * never stored anywhere, so the only way in is POST /api/auth/demo; the .invalid e-mail can't
 * match a real Google account either.
 */
@Component
@ConditionalOnProperty(name = "app.demo.enabled", havingValue = "true")
public class DemoAccountInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String username;

    public DemoAccountInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
                                  @Value("${app.demo.username:demo}") String username) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByUsername(username)) return;
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);

        User demo = new User();
        demo.setUsername(username);
        demo.setEmail(username + "@skatemap.invalid");
        demo.setPassword(passwordEncoder.encode(Base64.getEncoder().encodeToString(secret)));
        userRepository.save(demo);
        log.info("Demo account '{}' created", username);
    }
}
