package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import skatemap.exception.ApiException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.dto.RatingDto;
import skatemap.dto.SpotDto;
import skatemap.service.SpotService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spots")
public class SpotController {

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    /** Max search radius for /nearby, so one request can't scan the whole table. */
    static final double MAX_NEARBY_METERS = 50_000;

    // Requires login
    @PostMapping
    public ResponseEntity<SpotDto> createSpot(@Valid @RequestBody SpotDto spotDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        SpotDto newSpot = spotService.createSpot(spotDto, username);
        return ResponseEntity.ok(newSpot);
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

    // Comments of a spot
    @GetMapping("/{spotId}/comments")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        return revalidate(spotService.getCommentsBySpot(spotId));
    }

    // Rating the current user gave to this spot
    @GetMapping("/{spotId}/my-rating")
    public ResponseEntity<RatingDto> getMyRating(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        return ResponseEntity.ok(spotService.getUserRating(spotId, username));
    }
    // Admins only
    @DeleteMapping("/{spotId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteSpot(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        spotService.deleteSpot(spotId, auth.getName());
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