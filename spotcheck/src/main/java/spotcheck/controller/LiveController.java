package spotcheck.controller;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import spotcheck.dto.SocialDtos.CheckinRequest;
import spotcheck.dto.SocialDtos.SessionCreate;
import spotcheck.service.LiveService;
import spotcheck.service.LiveService.SpotDetail;
import spotcheck.service.LiveService.SpotLive;
import spotcheck.service.SessionService;
import spotcheck.service.SessionService.SessionItem;

import java.util.List;

/**
 * Live layer: check-ins ("I'm skating here") and planned sessions. Reads are public; the map also
 * gets count changes pushed over WebSocket (/ws, topic /topic/live).
 */
@RestController
@RequestMapping("/api")
public class LiveController {

    private final LiveService liveService;
    private final SessionService sessionService;

    public LiveController(LiveService liveService, SessionService sessionService) {
        this.liveService = liveService;
        this.sessionService = sessionService;
    }

    /** Every spot with skaters right now; the map's first paint before the socket connects. */
    @GetMapping("/spots/live")
    public ResponseEntity<List<SpotLive>> live() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(liveService.counts());
    }

    @GetMapping("/spots/{spotId}/live")
    public ResponseEntity<SpotDetail> liveAt(@PathVariable Long spotId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(liveService.at(spotId));
    }

    /** Only on site: the phone's position must be within 300 m of the spot. */
    @PostMapping("/spots/{spotId}/checkin")
    public ResponseEntity<SpotDetail> checkIn(@PathVariable Long spotId, @Valid @RequestBody CheckinRequest request,
                                              Authentication auth) {
        return ResponseEntity.ok(liveService.checkIn(auth.getName(), spotId, request.latitude(), request.longitude()));
    }

    /** Leave wherever you are checked in. */
    @DeleteMapping("/spots/{spotId}/checkin")
    public ResponseEntity<Void> checkOut(@PathVariable Long spotId, Authentication auth) {
        liveService.checkOut(auth.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/spots/{spotId}/sessions")
    public ResponseEntity<List<SessionItem>> sessions(@PathVariable Long spotId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessionService.upcoming(spotId));
    }

    @PostMapping("/spots/{spotId}/sessions")
    public ResponseEntity<SessionItem> createSession(@PathVariable Long spotId, @Valid @RequestBody SessionCreate request,
                                                     Authentication auth) {
        return ResponseEntity.ok(sessionService.create(auth.getName(), spotId, request.startsAt(), request.note()));
    }

    /** My upcoming sessions, hosted or joined (profile). */
    @GetMapping("/users/me/sessions")
    public ResponseEntity<List<SessionItem>> mySessions(Authentication auth) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sessionService.mine(auth.getName()));
    }

    @PostMapping("/sessions/{sessionId}/join")
    public ResponseEntity<SessionItem> join(@PathVariable Long sessionId, Authentication auth) {
        return ResponseEntity.ok(sessionService.join(auth.getName(), sessionId));
    }

    @DeleteMapping("/sessions/{sessionId}/join")
    public ResponseEntity<SessionItem> leave(@PathVariable Long sessionId, Authentication auth) {
        return ResponseEntity.ok(sessionService.leave(auth.getName(), sessionId));
    }

    @PatchMapping("/sessions/{sessionId}")
    public ResponseEntity<SessionItem> updateSession(@PathVariable Long sessionId, @Valid @RequestBody SessionCreate request,
                                                     Authentication auth) {
        return ResponseEntity.ok(sessionService.update(auth.getName(), sessionId, request.startsAt(), request.note()));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> cancel(@PathVariable Long sessionId, Authentication auth) {
        sessionService.cancel(auth.getName(), sessionId);
        return ResponseEntity.noContent().build();
    }
}
