package spotcheck.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spotcheck.dto.ModerationItemDto;
import spotcheck.dto.ModerationItemDto.ReportItem;
import spotcheck.entity.Comment;
import spotcheck.entity.ModerationAction;
import spotcheck.entity.Spot;
import spotcheck.entity.SpotReport;
import spotcheck.entity.enums.PhotoStatus;
import spotcheck.entity.enums.ReportReason;
import spotcheck.entity.enums.ReportStatus;
import spotcheck.entity.enums.SpotStatus;
import spotcheck.exception.ApiException;
import spotcheck.repository.CommentRepository;
import spotcheck.repository.ModerationActionRepository;
import spotcheck.repository.SpotReportRepository;
import spotcheck.repository.SpotRepository;
import spotcheck.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static spotcheck.service.ReportReviewService.PENDING;

/**
 * Admin moderation queue and decisions. Every decision is written to moderation_actions, updates
 * the reporters' reputation, and (for removals) deletes the photo from Cloudinary.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationService {

    public enum Filter { REPORTED, NEW, HIDDEN, ALL }

    /** Threshold after an admin has kept a reported spot, so the same crowd can't hide it again at once. */
    static final int THRESHOLD_AFTER_KEEP = 5;
    private static final int MAX_PAGE_SIZE = 50;

    private static final Logger log = LoggerFactory.getLogger(AdminModerationService.class);

    private final SpotRepository spotRepository;
    private final SpotReportRepository reportRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final ModerationActionRepository actionRepository;
    private final SpotService spotService;
    private final CloudinaryAssets cloudinaryAssets;
    private final SpotListCache spotListCache;

    public AdminModerationService(SpotRepository spotRepository, SpotReportRepository reportRepository,
                                  CommentRepository commentRepository, UserRepository userRepository,
                                  ModerationActionRepository actionRepository, SpotService spotService,
                                  CloudinaryAssets cloudinaryAssets, SpotListCache spotListCache) {
        this.spotRepository = spotRepository;
        this.reportRepository = reportRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.actionRepository = actionRepository;
        this.spotService = spotService;
        this.cloudinaryAssets = cloudinaryAssets;
        this.spotListCache = spotListCache;
    }

    @Transactional(readOnly = true)
    public ModerationItemDto.Page queue(Filter filter, int page, int size) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        List<Spot> spots;
        int totalPages;
        long total;
        if (filter == Filter.REPORTED) {
            Page<SpotReportRepository.SpotScore> scores = reportRepository.findSpotScores(PENDING, request);
            List<Long> ids = scores.getContent().stream().map(SpotReportRepository.SpotScore::getSpotId).toList();
            Map<Long, Spot> byId = spotRepository.findAllByIdIn(ids).stream()
                    .collect(Collectors.toMap(Spot::getId, Function.identity()));
            spots = ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
            totalPages = scores.getTotalPages();
            total = scores.getTotalElements();
        } else {
            Page<Spot> result = switch (filter) {
                case NEW -> spotRepository.findByReviewedAtIsNullOrderByCreatedAtDesc(request);
                case HIDDEN -> spotRepository.findByStatusOrPhotoStatusOrderByIdDesc(SpotStatus.HIDDEN, PhotoStatus.HIDDEN, request);
                default -> spotRepository.findAllByOrderByIdDesc(request);
            };
            spots = result.getContent();
            totalPages = result.getTotalPages();
            total = result.getTotalElements();
        }
        return new ModerationItemDto.Page(toItems(spots), request.getPageNumber(), totalPages, total);
    }

    @Transactional(readOnly = true)
    public ModerationItemDto.Counts counts() {
        return new ModerationItemDto.Counts(
                reportRepository.countSpotsWithStatus(PENDING),
                spotRepository.countByReviewedAtIsNull(),
                spotRepository.countByStatusOrPhotoStatus(SpotStatus.HIDDEN, PhotoStatus.HIDDEN));
    }

    /** The spot is fine: reports rejected, spot and photo visible, harder to hide again. */
    @Transactional
    public void keep(Long spotId, String admin) {
        Spot spot = find(spotId);
        int resolved = resolveReports(spotId, ReportStatus.REJECTED);
        if (resolved > 0) spot.setReportThreshold(Math.max(spot.getReportThreshold(), THRESHOLD_AFTER_KEEP));
        spot.setStatus(SpotStatus.VISIBLE);
        spot.setPhotoStatus(PhotoStatus.OK);
        spot.setReviewedAt(LocalDateTime.now());
        spotRepository.save(spot);
        spotListCache.invalidate();
        record(spot, ModerationAction.Type.KEEP, resolved > 0 ? resolved + " report(s) rejected" : null, admin);
    }

    /** Deletes the spot, its comments, ratings, reports and photo. */
    @Transactional
    public void remove(Long spotId, String reason, String admin) {
        Spot spot = find(spotId);
        resolveReports(spotId, ReportStatus.UPHELD);
        record(spot, ModerationAction.Type.REMOVE_SPOT, reason, admin);
        log.info("Spot {} by {} removed by {}: {}", spotId, spot.getCreatedBy().getUsername(), admin, reason);
        spotService.deleteSpot(spotId, admin);
    }

    /** Deletes only the photo (also from Cloudinary); the spot stays on the map. */
    @Transactional
    public void removePhoto(Long spotId, String admin) {
        Spot spot = find(spotId);
        String mediaUrl = spot.getMediaUrl();
        resolveReports(spotId, ReportStatus.UPHELD);
        spot.setMediaUrl(null);
        spot.setPhotoStatus(PhotoStatus.OK);
        spot.setStatus(SpotStatus.VISIBLE);
        spot.setReviewedAt(LocalDateTime.now());
        spotRepository.save(spot);
        spotListCache.invalidate();
        record(spot, ModerationAction.Type.REMOVE_PHOTO, null, admin);
        cloudinaryAssets.destroy(mediaUrl);
    }

    /** A photo hidden by the AI was fine after all. */
    @Transactional
    public void restorePhoto(Long spotId, String admin) {
        Spot spot = find(spotId);
        spot.setPhotoStatus(PhotoStatus.OK);
        spot.setReviewedAt(LocalDateTime.now());
        spotRepository.save(spot);
        spotListCache.invalidate();
        record(spot, ModerationAction.Type.RESTORE_PHOTO, null, admin);
    }

    @Transactional
    public void deleteComment(Long commentId, String admin) {
        Comment comment = commentRepository.findById(commentId).orElseThrow(() -> ApiException.notFound("Comment"));
        Spot spot = comment.getSpot();
        record(spot, ModerationAction.Type.DELETE_COMMENT,
                "Comment " + commentId + " by " + comment.getUser().getUsername(), admin);
        commentRepository.delete(comment);
    }

    // --- helpers ---

    private Spot find(Long spotId) {
        return spotRepository.findById(spotId).orElseThrow(() -> ApiException.notFound("Spot"));
    }

    /** Closes the pending reports of a spot and updates their authors' reputation. */
    private int resolveReports(Long spotId, ReportStatus outcome) {
        List<Long> reporters = reportRepository.findReporterIds(spotId, PENDING);
        int resolved = reportRepository.resolve(spotId, PENDING, outcome, LocalDateTime.now());
        if (!reporters.isEmpty()) {
            if (outcome == ReportStatus.UPHELD) userRepository.incrementReportsUpheld(reporters);
            else userRepository.incrementReportsRejected(reporters);
        }
        return resolved;
    }

    private void record(Spot spot, ModerationAction.Type type, String reason, String admin) {
        actionRepository.save(new ModerationAction(spot.getId(), spot.getName(),
                spot.getCreatedBy().getUsername(), type, reason, admin));
    }

    private List<ModerationItemDto> toItems(List<Spot> spots) {
        if (spots.isEmpty()) return List.of();
        List<Long> ids = spots.stream().map(Spot::getId).toList();
        Map<Long, List<SpotReport>> reportsBySpot = reportRepository
                .findBySpotIdInAndStatusInOrderByCreatedAtDesc(ids, PENDING).stream()
                .collect(Collectors.groupingBy(r -> r.getSpot().getId()));
        Map<Long, Long> comments = new HashMap<>();
        commentRepository.countBySpotIds(ids).forEach(c -> comments.put(c.getSpotId(), c.getTotal()));
        return spots.stream()
                .map(spot -> toItem(spot, reportsBySpot.getOrDefault(spot.getId(), List.of()),
                        comments.getOrDefault(spot.getId(), 0L)))
                .toList();
    }

    private static ModerationItemDto toItem(Spot spot, List<SpotReport> reports, long commentCount) {
        Map<ReportReason, Long> reasons = new EnumMap<>(ReportReason.class);
        reports.forEach(r -> reasons.merge(r.getReason(), 1L, Long::sum));
        double score = reports.stream().mapToDouble(SpotReport::getWeight).sum();
        List<ReportItem> items = reports.stream()
                .map(r -> new ReportItem(r.getId(), r.getReason(), r.getComment(), r.getReporter().getUsername(),
                        r.getCreatedAt(), r.getStatus(), r.getWeight()))
                .toList();
        Double rating = spot.getSurfaceRating();
        return new ModerationItemDto(
                spot.getId(), spot.getName(), spot.getDescription(), spot.getSpotType(), spot.getDifficultyLevel(),
                spot.getMediaUrl(),
                spot.getLocation() == null ? null : spot.getLocation().getY(),
                spot.getLocation() == null ? null : spot.getLocation().getX(),
                spot.getCreatedBy().getUsername(), spot.getCreatedAt(),
                spot.getStatus(), spot.getPhotoStatus(), spot.getReviewedAt(),
                spot.getAiVerdict(), spot.getAiReason(),
                Math.round(score * 10.0) / 10.0, spot.getReportThreshold(), reports.size(), reasons, items,
                commentCount, rating == null ? 0 : Math.round(rating * 10.0) / 10.0);
    }
}
