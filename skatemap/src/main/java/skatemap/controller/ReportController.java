package skatemap.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import skatemap.entity.enums.ReportReason;
import skatemap.service.ReportService;

import java.util.Map;

/** Users report a spot (login required, rate limited). The AI review runs in the background. */
@RestController
@RequestMapping("/api/spots")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    public record ReportRequest(@NotNull ReportReason reason, @Size(max = 300) String comment) {}

    @PostMapping("/{spotId}/reports")
    public ResponseEntity<Map<String, String>> report(@PathVariable Long spotId,
                                                      @Valid @RequestBody ReportRequest request,
                                                      Authentication auth) {
        reportService.submit(spotId, auth.getName(), request.reason(), request.comment());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "received"));
    }
}
