package spotcheck.dto;

import spotcheck.entity.enums.DifficultyLevel;
import spotcheck.entity.enums.PhotoStatus;
import spotcheck.entity.enums.ReportReason;
import spotcheck.entity.enums.ReportStatus;
import spotcheck.entity.enums.SpotStatus;
import spotcheck.entity.enums.SpotType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** A spot as the admin sees it: hidden fields included, with its pending reports and the AI opinion. */
public record ModerationItemDto(
        Long id,
        String name,
        String description,
        SpotType spotType,
        DifficultyLevel difficultyLevel,
        String mediaUrl,
        Double latitude,
        Double longitude,
        String createdBy,
        LocalDateTime createdAt,
        SpotStatus status,
        PhotoStatus photoStatus,
        LocalDateTime reviewedAt,
        String aiVerdict,
        String aiReason,
        double reportScore,
        int reportThreshold,
        int reportCount,
        Map<ReportReason, Long> reasons,
        List<ReportItem> reports,
        long commentCount,
        double surfaceRating
) {
    public record ReportItem(Long id, ReportReason reason, String comment, String reporter,
                             LocalDateTime createdAt, ReportStatus status, double weight) {}

    public record Page(List<ModerationItemDto> items, int page, int totalPages, long total) {}

    public record Counts(long reported, long fresh, long hidden) {}
}
