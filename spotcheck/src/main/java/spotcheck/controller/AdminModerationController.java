package spotcheck.controller;

import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import spotcheck.dto.ModerationItemDto;
import spotcheck.exception.ApiException;
import spotcheck.service.AdminModerationService;
import spotcheck.service.AdminModerationService.Filter;

/** Moderation for admins: the queue (reported / new / hidden / all) and the decisions. */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    private final AdminModerationService service;

    public AdminModerationController(AdminModerationService service) {
        this.service = service;
    }

    public record RemoveRequest(@Size(max = 500) String reason) {}

    public record PhotoRequest(String action) {}

    @GetMapping("/moderation")
    public ModerationItemDto.Page queue(@RequestParam(defaultValue = "REPORTED") Filter filter,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return service.queue(filter, page, size);
    }

    @GetMapping("/moderation/counts")
    public ModerationItemDto.Counts counts() {
        return service.counts();
    }

    @PostMapping("/spots/{spotId}/keep")
    public ResponseEntity<Void> keep(@PathVariable Long spotId, Authentication auth) {
        service.keep(spotId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/spots/{spotId}/remove")
    public ResponseEntity<Void> remove(@PathVariable Long spotId,
                                       @RequestBody(required = false) RemoveRequest body,
                                       Authentication auth) {
        service.remove(spotId, body == null ? null : body.reason(), auth.getName());
        return ResponseEntity.noContent().build();
    }

    /** {"action": "remove"} deletes the photo; {"action": "restore"} shows a photo the AI had hidden. */
    @PostMapping("/spots/{spotId}/photo")
    public ResponseEntity<Void> photo(@PathVariable Long spotId, @RequestBody PhotoRequest body, Authentication auth) {
        String action = body == null || body.action() == null ? "" : body.action();
        switch (action) {
            case "remove" -> service.removePhoto(spotId, auth.getName());
            case "restore" -> service.restorePhoto(spotId, auth.getName());
            default -> throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "action must be remove or restore");
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId, Authentication auth) {
        service.deleteComment(commentId, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
