package spotcheck.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import spotcheck.entity.User;
import spotcheck.exception.ApiException;
import spotcheck.repository.UserRepository;

import java.util.Optional;

/** Finds users by name for the social endpoints and knows which one is the shared demo account. */
@Service
public class UserLookup {

    private final UserRepository userRepository;
    private final boolean demoEnabled;
    private final String demoUsername;

    public UserLookup(UserRepository userRepository,
                      @Value("${app.demo.enabled:false}") boolean demoEnabled,
                      @Value("${app.demo.username:demo}") String demoUsername) {
        this.userRepository = userRepository;
        this.demoEnabled = demoEnabled;
        this.demoUsername = demoUsername;
    }

    /** An active (not deleted) user, or 404. */
    public User require(String username) {
        return userRepository.findByUsername(username)
                .filter(u -> !u.isDeleted())
                .orElseThrow(() -> ApiException.notFound("User"));
    }

    /** The signed-in user of the current request, if any (public endpoints personalise with it). */
    public Optional<User> current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return userRepository.findByUsername(auth.getName()).filter(u -> !u.isDeleted());
    }

    public boolean isDemo(User user) {
        return demoEnabled && user.getUsername().equals(demoUsername);
    }

    /** The demo account is shared by every visitor, so nobody may change or delete it. */
    public void forbidDemo(User user) {
        if (isDemo(user)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "demo_readonly", "Not available on the demo account");
        }
    }
}
