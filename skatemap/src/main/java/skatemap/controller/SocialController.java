package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.SocialDtos.CursorPage;
import skatemap.dto.SocialDtos.FeedItem;
import skatemap.dto.SocialDtos.NotificationPage;
import skatemap.dto.SocialDtos.PushTokenRequest;
import skatemap.dto.SpotDto;
import skatemap.service.FavoriteService;
import skatemap.service.FeedService;
import skatemap.service.NotificationService;
import skatemap.service.PushService;

import java.util.List;
import java.util.Map;

/** Signed-in only: feed, favorites, notifications and push tokens. */
@RestController
@RequestMapping("/api")
public class SocialController {

    private final FeedService feedService;
    private final FavoriteService favoriteService;
    private final NotificationService notificationService;
    private final PushService pushService;

    public SocialController(FeedService feedService, FavoriteService favoriteService,
                            NotificationService notificationService, PushService pushService) {
        this.feedService = feedService;
        this.favoriteService = favoriteService;
        this.notificationService = notificationService;
        this.pushService = pushService;
    }

    // --- Feed ---

    @GetMapping("/feed")
    public ResponseEntity<CursorPage<FeedItem>> feed(@RequestParam(required = false) Long before, Authentication auth) {
        return ResponseEntity.ok(feedService.feed(auth.getName(), before));
    }

    // --- Favorites ---

    /** Ids of the saved spots: the map marks them without another request per spot. */
    @GetMapping("/favorites")
    public ResponseEntity<List<Long>> favoriteIds(Authentication auth) {
        return ResponseEntity.ok(favoriteService.ids(auth.getName()));
    }

    @GetMapping("/favorites/spots")
    public ResponseEntity<List<SpotDto>> favoriteSpots(Authentication auth) {
        return ResponseEntity.ok(favoriteService.spots(auth.getName()));
    }

    @PutMapping("/favorites/{spotId}")
    public ResponseEntity<Void> addFavorite(@PathVariable Long spotId, Authentication auth) {
        favoriteService.add(auth.getName(), spotId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/favorites/{spotId}")
    public ResponseEntity<Void> removeFavorite(@PathVariable Long spotId, Authentication auth) {
        favoriteService.remove(auth.getName(), spotId);
        return ResponseEntity.noContent().build();
    }

    // --- Notifications ---

    @GetMapping("/notifications")
    public ResponseEntity<NotificationPage> notifications(@RequestParam(required = false) Long before,
                                                          Authentication auth) {
        return ResponseEntity.ok(notificationService.page(auth.getName(), before));
    }

    /** Polled for the badge; one indexed count. */
    @GetMapping("/notifications/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(Authentication auth) {
        return ResponseEntity.ok(Map.of("unread", notificationService.unreadCount(auth.getName())));
    }

    @PostMapping("/notifications/read")
    public ResponseEntity<Void> markRead(Authentication auth) {
        notificationService.markAllRead(auth.getName());
        return ResponseEntity.noContent().build();
    }

    // --- Push tokens (mobile app) ---

    @PostMapping("/push-tokens")
    public ResponseEntity<Void> registerPushToken(@Valid @RequestBody PushTokenRequest request, Authentication auth) {
        pushService.register(auth.getName(), request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/push-tokens/unregister")
    public ResponseEntity<Void> unregisterPushToken(@Valid @RequestBody PushTokenRequest request, Authentication auth) {
        pushService.unregister(auth.getName(), request.token());
        return ResponseEntity.noContent().build();
    }
}
