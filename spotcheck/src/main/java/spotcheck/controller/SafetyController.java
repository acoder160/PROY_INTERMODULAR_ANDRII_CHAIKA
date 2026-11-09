package spotcheck.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import spotcheck.entity.enums.ReportReason;
import spotcheck.service.SafetyService;
import spotcheck.service.SafetyService.Action;
import spotcheck.service.SafetyService.BlockedUser;
import spotcheck.service.SafetyService.ReportItem;

import java.util.List;
import java.util.Map;

/** Blocking users and reporting comments and profiles; the admin queue for those reports. */
@RestController
@RequestMapping("/api")
public class SafetyController {

    public record ReportRequest(@NotNull ReportReason reason, @Size(max = 300) String comment) {}

    public record ResolveRequest(@NotNull Action action) {}

    private final SafetyService safety;

    public SafetyController(SafetyService safety) {
        this.safety = safety;
    }

    @PutMapping("/users/{username}/block")
    public ResponseEntity<Void> block(@PathVariable String username, Authentication auth) {
        safety.block(auth.getName(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{username}/block")
    public ResponseEntity<Void> unblock(@PathVariable String username, Authentication auth) {
        safety.unblock(auth.getName(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/me/blocks")
    public ResponseEntity<List<BlockedUser>> blocks(Authentication auth) {
        return ResponseEntity.ok(safety.blockedBy(auth.getName()));
    }

    @PostMapping("/comments/{commentId}/reports")
    public ResponseEntity<Map<String, String>> reportComment(@PathVariable Long commentId,
                                                             @Valid @RequestBody ReportRequest request,
                                                             Authentication auth) {
        safety.reportComment(commentId, auth.getName(), request.reason(), request.comment());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "received"));
    }

    @PostMapping("/users/{username}/reports")
    public ResponseEntity<Map<String, String>> reportUser(@PathVariable String username,
                                                          @Valid @RequestBody ReportRequest request,
                                                          Authentication auth) {
        safety.reportUser(username, auth.getName(), request.reason(), request.comment());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "received"));
    }

    // --- Admin ---

    @GetMapping("/admin/content-reports")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ReportItem> openReports() {
        return safety.openReports();
    }

    @PostMapping("/admin/content-reports/{id}/resolve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resolve(@PathVariable Long id, @Valid @RequestBody ResolveRequest body,
                                        Authentication auth) {
        safety.resolve(id, body.action(), auth.getName());
        return ResponseEntity.noContent().build();
    }
}
