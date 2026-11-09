package spotcheck.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import spotcheck.dto.SocialDtos.FollowState;
import spotcheck.dto.SocialDtos.Me;
import spotcheck.dto.SocialDtos.Profile;
import spotcheck.dto.SocialDtos.ProfileUpdate;
import spotcheck.dto.SocialDtos.UserListItem;
import spotcheck.dto.SpotDto;
import spotcheck.service.ProfileService;
import spotcheck.service.RefreshTokenService;

import java.util.List;

/**
 * Profiles and follows. {@code /me} is the signed-in account; every other path takes a username
 * ("me" can't be registered as one). Profiles are public; changing anything needs a JWT.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final ProfileService profileService;
    private final RefreshTokenService refreshTokenService;

    public UserController(ProfileService profileService, RefreshTokenService refreshTokenService) {
        this.profileService = profileService;
        this.refreshTokenService = refreshTokenService;
    }

    @GetMapping("/me")
    public ResponseEntity<Me> me(Authentication auth) {
        return ResponseEntity.ok(profileService.me(auth.getName()));
    }

    @PatchMapping("/me")
    public ResponseEntity<Me> updateMe(@Valid @RequestBody ProfileUpdate update, Authentication auth) {
        return ResponseEntity.ok(profileService.update(auth.getName(), update));
    }

    /** Deletes the account (see ProfileService#deleteAccount) and clears the web refresh cookie. */
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(Authentication auth) {
        profileService.deleteAccount(auth.getName());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenService.clearCookie().toString())
                .build();
    }

    @GetMapping("/{username}")
    public ResponseEntity<Profile> profile(@PathVariable String username) {
        return ResponseEntity.ok(profileService.profile(username));
    }

    @GetMapping("/{username}/spots")
    public ResponseEntity<List<SpotDto>> spots(@PathVariable String username) {
        return ResponseEntity.ok(profileService.spotsOf(username));
    }

    @GetMapping("/{username}/followers")
    public ResponseEntity<List<UserListItem>> followers(@PathVariable String username,
                                                        @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(profileService.followers(username, page));
    }

    @GetMapping("/{username}/following")
    public ResponseEntity<List<UserListItem>> following(@PathVariable String username,
                                                        @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(profileService.following(username, page));
    }

    @PostMapping("/{username}/follow")
    public ResponseEntity<FollowState> follow(@PathVariable String username, Authentication auth) {
        return ResponseEntity.ok(profileService.follow(auth.getName(), username));
    }

    @DeleteMapping("/{username}/follow")
    public ResponseEntity<FollowState> unfollow(@PathVariable String username, Authentication auth) {
        return ResponseEntity.ok(profileService.unfollow(auth.getName(), username));
    }
}
