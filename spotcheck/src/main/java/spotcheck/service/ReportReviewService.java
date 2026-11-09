package spotcheck.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import spotcheck.entity.Spot;
import spotcheck.entity.SpotReport;
import spotcheck.entity.enums.PhotoStatus;
import spotcheck.entity.enums.ReportReason;
import spotcheck.entity.enums.ReportStatus;
import spotcheck.entity.enums.SpotStatus;
import spotcheck.repository.SpotReportRepository;
import spotcheck.repository.SpotRepository;
import spotcheck.service.ImageModerationService.ReportLine;
import spotcheck.service.ImageModerationService.ReportReview;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides what happens to a reported spot until an admin looks at it.
 *
 * 1. The AI reads the spot (name, description, photo) and the reports:
 *    - confident violation (>= 0.8): the photo or the whole spot is hidden;
 *    - confident false alarm (>= 0.8): the reports are marked AI_DISMISSED, the spot stays;
 *    - unsure: nothing changes, the admin decides.
 *    The AI is only asked again when a report brings a reason it has not judged yet, which saves
 *    the free quota and stops report spam from costing anything.
 * 2. Crowd threshold, whatever the AI said: once the weighted reports of the last 30 days reach the
 *    spot's threshold (3, or 5 after an admin kept it) the spot is hidden.
 *
 * Hiding is never final: the admin keeps or removes.
 */
@Service
public class ReportReviewService {

    private static final Logger log = LoggerFactory.getLogger(ReportReviewService.class);

    static final double AI_CONFIDENCE = 0.8;
    static final Duration CROWD_WINDOW = Duration.ofDays(30);
    static final List<ReportStatus> PENDING = List.of(ReportStatus.OPEN, ReportStatus.AI_DISMISSED);

    enum Action { NONE, HIDE_PHOTO, HIDE_SPOT, DISMISS }

    private record Snapshot(String mediaUrl, String name, String description, String spotType,
                            List<ReportLine> reports, boolean needsAi) {}

    private final SpotRepository spotRepository;
    private final SpotReportRepository reportRepository;
    private final ImageModerationService ai;
    private final SpotListCache spotListCache;
    private final TransactionTemplate tx;

    public ReportReviewService(SpotRepository spotRepository, SpotReportRepository reportRepository,
                               ImageModerationService ai, SpotListCache spotListCache,
                               PlatformTransactionManager transactionManager) {
        this.spotRepository = spotRepository;
        this.reportRepository = reportRepository;
        this.ai = ai;
        this.spotListCache = spotListCache;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @Async("moderationExecutor")
    public void reviewAsync(Long spotId) {
        try {
            review(spotId);
        } catch (Exception e) {
            log.warn("Review of reported spot {} failed: {}", spotId, e.toString());
        }
    }

    /** Three steps so no database connection is held while the AI is thinking. */
    public void review(Long spotId) {
        Snapshot snapshot = tx.execute(status -> snapshot(spotId));
        if (snapshot == null) return;
        ReportReview review = snapshot.needsAi()
                ? ai.reviewReports(snapshot.mediaUrl(), snapshot.name(), snapshot.description(),
                        snapshot.spotType(), snapshot.reports())
                : null;
        tx.executeWithoutResult(status -> apply(spotId, review));
    }

    private Snapshot snapshot(Long spotId) {
        Spot spot = spotRepository.findById(spotId).orElse(null);
        if (spot == null || !spot.isPublic()) return null;
        List<SpotReport> pending = reportRepository.findBySpotIdAndStatusInOrderByCreatedAtDesc(spotId, PENDING);
        if (pending.isEmpty()) return null;
        List<ReportLine> lines = pending.stream()
                .map(r -> new ReportLine(r.getReason().name(), r.getComment()))
                .toList();
        String photo = spot.getPhotoStatus() == PhotoStatus.HIDDEN ? null : spot.getMediaUrl();
        return new Snapshot(photo, spot.getName(), spot.getDescription(), String.valueOf(spot.getSpotType()),
                lines, needsAi(spot.getAiCheckedAt(), pending));
    }

    private void apply(Long spotId, ReportReview review) {
        Spot spot = spotRepository.findById(spotId).orElse(null);
        if (spot == null) return;
        List<SpotReport> pending = reportRepository.findBySpotIdAndStatusInOrderByCreatedAtDesc(spotId, PENDING);
        if (pending.isEmpty()) return;

        boolean wasPublic = spot.isPublic();
        PhotoStatus photoBefore = spot.getPhotoStatus();
        LocalDateTime now = LocalDateTime.now();

        if (review != null) {
            spot.setAiVerdict(review.verdict());
            spot.setAiReason(review.explanation());
            spot.setAiCheckedAt(now);
            switch (decide(review, spot.getMediaUrl() != null && photoBefore == PhotoStatus.OK)) {
                case HIDE_PHOTO -> spot.setPhotoStatus(PhotoStatus.HIDDEN);
                case HIDE_SPOT -> spot.setStatus(SpotStatus.HIDDEN);
                case DISMISS -> pending.stream()
                        .filter(r -> r.getStatus() == ReportStatus.OPEN)
                        .forEach(r -> r.setStatus(ReportStatus.AI_DISMISSED));
                case NONE -> { }
            }
        }

        double score = crowdScore(pending, now);
        if (spot.isPublic() && score >= spot.getReportThreshold()) {
            spot.setStatus(SpotStatus.HIDDEN);
            log.info("Spot {} hidden by the crowd threshold ({} >= {})", spotId, score, spot.getReportThreshold());
        }

        spotRepository.save(spot);
        if (wasPublic != spot.isPublic() || photoBefore != spot.getPhotoStatus()) {
            spotListCache.invalidate();
        }
    }

    /** The AI's opinion turned into an action. */
    static Action decide(ReportReview review, boolean hasVisiblePhoto) {
        if (review.photoHardFlag() && hasVisiblePhoto) return Action.HIDE_PHOTO;
        boolean confident = review.confidence() >= AI_CONFIDENCE;
        if ("VIOLATION".equals(review.verdict()) && confident) {
            return "PHOTO".equals(review.target()) && hasVisiblePhoto ? Action.HIDE_PHOTO : Action.HIDE_SPOT;
        }
        if ("OK".equals(review.verdict()) && confident) return Action.DISMISS;
        return Action.NONE;
    }

    /** Sum of report weights from the last 30 days (one report per user, by the unique constraint). */
    static double crowdScore(List<SpotReport> pending, LocalDateTime now) {
        LocalDateTime since = now.minus(CROWD_WINDOW);
        return pending.stream()
                .filter(r -> r.getCreatedAt() != null && r.getCreatedAt().isAfter(since))
                .mapToDouble(SpotReport::getWeight)
                .sum();
    }

    /**
     * The AI is asked again only if a report arrived after its last review with a reason it has not
     * judged yet.
     */
    static boolean needsAi(LocalDateTime aiCheckedAt, List<SpotReport> pending) {
        if (aiCheckedAt == null) return true;
        Set<ReportReason> judged = pending.stream()
                .filter(r -> !r.getCreatedAt().isAfter(aiCheckedAt))
                .map(SpotReport::getReason)
                .collect(Collectors.toSet());
        return pending.stream()
                .anyMatch(r -> r.getCreatedAt().isAfter(aiCheckedAt) && !judged.contains(r.getReason()));
    }
}
