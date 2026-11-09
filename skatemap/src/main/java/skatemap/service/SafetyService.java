package skatemap.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.entity.Comment;
import skatemap.entity.ContentReport;
import skatemap.entity.ContentReport.Status;
import skatemap.entity.ContentReport.Target;
import skatemap.entity.Follow;
import skatemap.entity.User;
import skatemap.entity.UserBlock;
import skatemap.entity.enums.ReportReason;
import skatemap.exception.ApiException;
import skatemap.repository.CommentRepository;
import skatemap.repository.ContentReportRepository;
import skatemap.repository.FollowRepository;
import skatemap.repository.UserBlockRepository;
import skatemap.repository.UserRepository;

import java.util.List;
import java.util.Set;

/**
 * Tools every app with user-generated content needs: blocking people and reporting comments and
 * profiles (spots have their own flow, see ReportService). Reports wait in a queue for an admin.
 */
@Service
public class SafetyService {

    static final int PAGE_SIZE = 50;

    public record BlockedUser(String username, String avatarUrl) {}

    public record ReportItem(Long id, Target targetType, Long targetId, ReportReason reason, String comment,
                             String reporter, java.time.LocalDateTime createdAt,
                             String targetUser, String preview) {}

    private final UserBlockRepository blockRepository;
    private final ContentReportRepository reportRepository;
    private final FollowRepository followRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final UserLookup userLookup;

    public SafetyService(UserBlockRepository blockRepository, ContentReportRepository reportRepository,
                         FollowRepository followRepository, CommentRepository commentRepository,
                         UserRepository userRepository, UserLookup userLookup) {
        this.blockRepository = blockRepository;
        this.reportRepository = reportRepository;
        this.followRepository = followRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.userLookup = userLookup;
    }

    // --- Blocking ---

    /** Blocks {@code targetName}: follows in both directions end, and their comments disappear for you. */
    @Transactional
    public void block(String blockerName, String targetName) {
        User blocker = userLookup.require(blockerName);
        User target = userLookup.require(targetName);
        if (blocker.getId().equals(target.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "cannot_block_self", "You can't block yourself");
        }
        userLookup.forbidDemo(blocker);
        if (blockRepository.existsByBlockerIdAndBlockedId(blocker.getId(), target.getId())) return;
        blockRepository.save(new UserBlock(blocker, target));
        followRepository.findByFollowerIdAndFolloweeId(blocker.getId(), target.getId()).ifPresent(followRepository::delete);
        followRepository.findByFollowerIdAndFolloweeId(target.getId(), blocker.getId()).ifPresent(followRepository::delete);
    }

    @Transactional
    public void unblock(String blockerName, String targetName) {
        User blocker = userLookup.require(blockerName);
        User target = userLookup.require(targetName);
        blockRepository.findByBlockerIdAndBlockedId(blocker.getId(), target.getId()).ifPresent(blockRepository::delete);
    }

    @Transactional(readOnly = true)
    public List<BlockedUser> blockedBy(String username) {
        User me = userLookup.require(username);
        return blockRepository.findByBlockerIdOrderByIdDesc(me.getId(), PageRequest.of(0, 200)).stream()
                .map(b -> new BlockedUser(b.getBlocked().getUsername(), b.getBlocked().getAvatarUrl()))
                .toList();
    }

    /** Ids of the users the signed-in user blocked (empty when anonymous). */
    public Set<Long> blockedByCurrent() {
        return userLookup.current().map(me -> Set.copyOf(blockRepository.blockedIds(me.getId()))).orElse(Set.of());
    }

    /** True when either user blocked the other. */
    public boolean areBlocked(User a, User b) {
        return blockRepository.existsBetween(a.getId(), b.getId());
    }

    public boolean hasBlocked(User blocker, User target) {
        return blockRepository.existsByBlockerIdAndBlockedId(blocker.getId(), target.getId());
    }

    // --- Reports on comments and profiles ---

    @Transactional
    public void reportComment(Long commentId, String reporterName, ReportReason reason, String text) {
        User reporter = userLookup.require(reporterName);
        Comment comment = commentRepository.findById(commentId)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> ApiException.notFound("Comment"));
        if (comment.getUser().getId().equals(reporter.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "own_content", "You can't report your own comment.");
        }
        save(reporter, Target.COMMENT, commentId, reason, text);
    }

    @Transactional
    public void reportUser(String targetName, String reporterName, ReportReason reason, String text) {
        User reporter = userLookup.require(reporterName);
        User target = userLookup.require(targetName);
        if (target.getId().equals(reporter.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "own_content", "You can't report yourself.");
        }
        save(reporter, Target.USER, target.getId(), reason, text);
    }

    private void save(User reporter, Target type, Long targetId, ReportReason reason, String text) {
        if (reportRepository.existsByReporterIdAndTargetTypeAndTargetId(reporter.getId(), type, targetId)) {
            throw alreadyReported();
        }
        ContentReport report = new ContentReport();
        report.setReporter(reporter);
        report.setTargetType(type);
        report.setTargetId(targetId);
        report.setReason(reason);
        report.setComment(text == null || text.isBlank() ? null : text.trim());
        try {
            reportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            throw alreadyReported(); // two taps at the same time
        }
    }

    private static ApiException alreadyReported() {
        return new ApiException(HttpStatus.CONFLICT, "already_reported", "You have already reported this.");
    }

    // --- Admin ---

    @Transactional(readOnly = true)
    public List<ReportItem> openReports() {
        return reportRepository.findByStatusOrderByIdDesc(Status.OPEN, PageRequest.of(0, PAGE_SIZE)).stream()
                .map(this::toItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public long openCount() {
        return reportRepository.countByStatus(Status.OPEN);
    }

    public enum Action { REMOVE, CLEAR_PROFILE, DISMISS }

    /**
     * REMOVE deletes the reported comment, CLEAR_PROFILE empties the reported profile's bio and photo,
     * DISMISS closes the report with no change. All reports on the same target are closed together.
     */
    @Transactional
    public void resolve(Long reportId, Action action, String admin) {
        ContentReport report = reportRepository.findById(reportId).orElseThrow(() -> ApiException.notFound("Report"));
        Status outcome = action == Action.DISMISS ? Status.DISMISSED : Status.ACTIONED;
        if (action == Action.REMOVE && report.getTargetType() == Target.COMMENT) {
            // Replies under it go too (ON DELETE CASCADE on comments.parent_id)
            commentRepository.findById(report.getTargetId()).ifPresent(commentRepository::delete);
        } else if (action == Action.CLEAR_PROFILE && report.getTargetType() == Target.USER) {
            userRepository.findById(report.getTargetId()).ifPresent(u -> {
                u.setBio(null);
                u.setAvatarUrl(null);
                userRepository.save(u);
            });
        } else if (action != Action.DISMISS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That action does not apply to this report");
        }
        report.resolve(outcome, admin);
        reportRepository.findByStatusAndTargetTypeAndTargetId(Status.OPEN, report.getTargetType(), report.getTargetId())
                .forEach(r -> r.resolve(outcome, admin));
    }

    private ReportItem toItem(ContentReport r) {
        String targetUser = null;
        String preview = null;
        if (r.getTargetType() == Target.COMMENT) {
            Comment c = commentRepository.findById(r.getTargetId()).orElse(null);
            if (c != null) {
                targetUser = c.getUser().getUsername();
                preview = c.isDeleted() ? null : c.getContent();
            }
        } else {
            User u = userRepository.findById(r.getTargetId()).orElse(null);
            if (u != null) {
                targetUser = u.getUsername();
                preview = u.getBio();
            }
        }
        return new ReportItem(r.getId(), r.getTargetType(), r.getTargetId(), r.getReason(), r.getComment(),
                r.getReporter().getUsername(), r.getCreatedAt(), targetUser, preview);
    }
}
