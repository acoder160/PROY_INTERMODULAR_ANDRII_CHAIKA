package spotcheck.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import spotcheck.entity.Spot;
import spotcheck.entity.SpotReport;
import spotcheck.entity.User;
import spotcheck.entity.enums.ReportReason;
import spotcheck.exception.ApiException;
import spotcheck.repository.SpotReportRepository;
import spotcheck.repository.SpotRepository;
import spotcheck.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Users report spots; the AI review runs in the background (ReportReviewService) so the user gets
 * an immediate answer.
 */
@Service
public class ReportService {

    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final SpotReportRepository reportRepository;
    private final ReportReviewService reviewService;

    public ReportService(SpotRepository spotRepository, UserRepository userRepository,
                         SpotReportRepository reportRepository, ReportReviewService reviewService) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.reportRepository = reportRepository;
        this.reviewService = reviewService;
    }

    public void submit(Long spotId, String username, ReportReason reason, String comment) {
        Spot spot = spotRepository.findById(spotId)
                .filter(Spot::isPublic)
                .orElseThrow(() -> ApiException.notFound("Spot"));
        User reporter = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User"));

        if (Objects.equals(spot.getCreatedBy().getId(), reporter.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "own_spot", "You can't report your own spot.");
        }
        if (reportRepository.existsBySpotIdAndReporterId(spotId, reporter.getId())) {
            throw alreadyReported();
        }

        SpotReport report = new SpotReport();
        report.setSpot(spot);
        report.setReporter(reporter);
        report.setReason(reason);
        report.setComment(comment == null || comment.isBlank() ? null : comment.trim());
        report.setWeight(weightFor(reporter, LocalDateTime.now()));
        try {
            reportRepository.save(report);
        } catch (DataIntegrityViolationException e) {
            throw alreadyReported(); // two taps at the same time
        }

        reviewService.reviewAsync(spotId);
    }

    /**
     * How much one report counts towards hiding a spot automatically:
     * 0 for reporters whose reports admins keep rejecting, 0.5 for accounts younger than a day
     * (cheap throwaway accounts), 1 otherwise.
     */
    static double weightFor(User reporter, LocalDateTime now) {
        int upheld = reporter.getReportsUpheld();
        int rejected = reporter.getReportsRejected();
        if (rejected >= 3 && rejected > upheld * 2) return 0;
        if (reporter.getCreatedAt() != null && reporter.getCreatedAt().isAfter(now.minusHours(24))) return 0.5;
        return 1;
    }

    private static ApiException alreadyReported() {
        return new ApiException(HttpStatus.CONFLICT, "already_reported", "You have already reported this spot.");
    }
}
