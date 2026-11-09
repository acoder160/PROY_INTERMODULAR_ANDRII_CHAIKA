package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import skatemap.exception.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.dto.SocialDtos.CursorPage;
import skatemap.dto.SocialDtos.SpotUpdate;
import skatemap.dto.SpotDto;
import skatemap.service.CommentService;
import skatemap.service.SpotService;

import java.util.List;

@RestController
@RequestMapping("/api/spots")
public class SpotController {

    private final SpotService spotService;
    private final CommentService commentService;

    public SpotController(SpotService spotService, CommentService commentService) {
        this.spotService = spotService;
        this.commentService = commentService;
    }

    /** Max search radius for /nearby, so one request can't scan the whole table. */
    static final double MAX_NEARBY_METERS = 50_000;

    // Requires login
    @PostMapping
    public ResponseEntity<SpotDto> createSpot(@Valid @RequestBody SpotDto spotDto, Authentication auth) {
        return ResponseEntity.ok(spotService.createSpot(spotDto, auth.getName()));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<SpotDto>> getNearbySpots(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5000") double dist) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || !(dist > 0)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid coordinates or distance");
        }
        List<SpotDto> spots = spotService.findSpotsNearby(lat, lng, Math.min(dist, MAX_NEARBY_METERS));
        return revalidate(spots);
    }

    // Every spot; served from memory (SpotListCache) with an ETag
    @GetMapping
    public ResponseEntity<List<SpotDto>> getAllSpots() {
        return revalidate(spotService.getAllSpots());
    }

    /** One spot, for shared links and feed items that open a spot the map hasn't loaded. */
    @GetMapping("/{spotId}")
    public ResponseEntity<SpotDto> getSpot(@PathVariable Long spotId) {
        return revalidate(spotService.getVisibleSpot(spotId));
    }

    /**
     * Comments of a spot: top-level comments newest first, each with its replies. Pass the
     * {@code nextCursor} of a page as {@code before} for the next one. The body depends on who asks
     * (likedByMe), so it may only be cached privately.
     */
    @GetMapping("/{spotId}/comments")
    public ResponseEntity<CursorPage<CommentDto>> getComments(@PathVariable Long spotId,
                                                              @RequestParam(required = false) Long before,
                                                              @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePrivate())
                .body(commentService.page(spotId, before, limit));
    }

    /** The author edits their spot's texts, type or level. */
    @PatchMapping("/{spotId}")
    public ResponseEntity<SpotDto> updateSpot(@PathVariable Long spotId, @Valid @RequestBody SpotUpdate update,
                                              Authentication auth) {
        return ResponseEntity.ok(spotService.updateOwnSpot(spotId, update, auth.getName()));
    }

    /** Admins may delete any spot; anyone else only their own (403 otherwise). */
    @DeleteMapping("/{spotId}")
    public ResponseEntity<Void> deleteSpot(@PathVariable Long spotId, Authentication auth) {
        boolean admin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (admin) {
            spotService.deleteSpot(spotId, auth.getName());
        } else {
            spotService.deleteOwnSpot(spotId, auth.getName());
        }
        return ResponseEntity.ok().build();
    }

    /**
     * Public data that changes rarely: clients may keep it but must check with the server before
     * reusing it. With the ETag filter an unchanged list costs a 304 with no body.
     */
    static <T> ResponseEntity<T> revalidate(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic()).body(body);
    }
}
