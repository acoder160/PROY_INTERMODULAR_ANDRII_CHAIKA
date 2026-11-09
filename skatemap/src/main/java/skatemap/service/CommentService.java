package skatemap.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import skatemap.dto.CommentDto;
import skatemap.dto.SocialDtos.CursorPage;
import skatemap.dto.SocialDtos.LikeState;
import skatemap.entity.Comment;
import skatemap.entity.CommentLike;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.ActivityType;
import skatemap.entity.enums.NotificationType;
import skatemap.exception.ApiException;
import skatemap.repository.CommentLikeRepository;
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Comments with one level of replies, likes, and edit/delete by their author.
 *
 * Writes call the AI moderation first and only then open a transaction (TransactionTemplate), so
 * a slow AI provider never holds a database connection. The comment, its feed activity and the
 * notifications then commit together.
 */
@Service
public class CommentService {

    static final int DEFAULT_PAGE = 20;
    static final int MAX_PAGE = 50;

    private final CommentRepository commentRepository;
    private final CommentLikeRepository likeRepository;
    private final RatingRepository ratingRepository;
    private final SpotRepository spotRepository;
    private final UserLookup userLookup;
    private final AiModerationService aiModerationService;
    private final FeedService feedService;
    private final NotificationService notificationService;
    private final TransactionTemplate tx;

    public CommentService(CommentRepository commentRepository, CommentLikeRepository likeRepository,
                          RatingRepository ratingRepository, SpotRepository spotRepository, UserLookup userLookup,
                          AiModerationService aiModerationService, FeedService feedService,
                          NotificationService notificationService, PlatformTransactionManager transactionManager) {
        this.commentRepository = commentRepository;
        this.likeRepository = likeRepository;
        this.ratingRepository = ratingRepository;
        this.spotRepository = spotRepository;
        this.userLookup = userLookup;
        this.aiModerationService = aiModerationService;
        this.feedService = feedService;
        this.notificationService = notificationService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public CommentDto add(Long spotId, String content, Long parentId, String username) {
        requireAllowed(content);
        return tx.execute(status -> {
            Spot spot = spotRepository.findById(spotId).filter(Spot::isPublic)
                    .orElseThrow(() -> ApiException.notFound("Spot"));
            User author = userLookup.require(username);

            Comment repliedTo = null;
            if (parentId != null) {
                repliedTo = commentRepository.findById(parentId)
                        .filter(c -> c.getSpot().getId().equals(spotId) && !c.isDeleted())
                        .orElseThrow(() -> ApiException.notFound("Comment"));
            }

            Comment comment = new Comment();
            comment.setSpot(spot);
            comment.setUser(author);
            comment.setContent(content.trim());
            // One level of threads: a reply to a reply joins the same thread
            if (repliedTo != null) {
                comment.setParent(repliedTo.getParent() != null ? repliedTo.getParent() : repliedTo);
            }
            commentRepository.save(comment);

            feedService.record(author, ActivityType.COMMENTED, spot, comment, null);
            User spotOwner = spot.getCreatedBy();
            if (repliedTo != null) {
                notificationService.notify(repliedTo.getUser(), author, NotificationType.REPLY, spot, comment);
            }
            // The spot owner hears about it once, not twice when the reply is to their own comment
            if (repliedTo == null || !repliedTo.getUser().getId().equals(spotOwner.getId())) {
                notificationService.notify(spotOwner, author, NotificationType.COMMENT_ON_SPOT, spot, comment);
            }
            return toDto(comment, Map.of(), Map.of(), Set.of());
        });
    }

    /**
     * One page of top-level comments, newest first, each with all its replies. A fixed number of
     * queries whatever the page holds: comments, replies, like counts, the viewer's likes, ratings.
     */
    @Transactional(readOnly = true)
    public CursorPage<CommentDto> page(Long spotId, Long before, Integer limit) {
        int size = limit == null ? DEFAULT_PAGE : Math.max(1, Math.min(limit, MAX_PAGE));
        List<Comment> top = commentRepository.findBySpotIdAndParentIsNullAndIdLessThanOrderByIdDesc(
                spotId, NotificationService.cursor(before), PageRequest.of(0, size));
        if (top.isEmpty()) return new CursorPage<>(List.of(), null);

        List<Long> topIds = top.stream().map(Comment::getId).toList();
        List<Comment> replies = commentRepository.findByParentIdInOrderByIdAsc(topIds);

        List<Long> allIds = new ArrayList<>(topIds);
        replies.forEach(r -> allIds.add(r.getId()));
        Map<Long, Long> likes = new HashMap<>();
        likeRepository.countByCommentIds(allIds).forEach(l -> likes.put(l.getCommentId(), l.getTotal()));
        Set<Long> mine = userLookup.current()
                .map(me -> (Set<Long>) new HashSet<>(likeRepository.likedByUser(me.getId(), allIds)))
                .orElse(Set.of());
        Map<Long, Integer> ratingByUser = new HashMap<>();
        ratingRepository.findUserRatingsBySpotId(spotId).forEach(r -> ratingByUser.put(r.getUserId(), r.getValue()));

        Map<Long, CommentDto> threads = new LinkedHashMap<>();
        for (Comment c : top) threads.put(c.getId(), toDto(c, likes, ratingByUser, mine));
        for (Comment r : replies) {
            CommentDto thread = threads.get(r.getParent().getId());
            if (thread != null) thread.getReplies().add(toDto(r, likes, ratingByUser, mine));
        }
        // A deleted comment with no replies left has nothing to show
        List<CommentDto> items = threads.values().stream()
                .filter(t -> !t.isDeleted() || !t.getReplies().isEmpty())
                .toList();
        Long next = top.size() == size ? top.get(top.size() - 1).getId() : null;
        return new CursorPage<>(items, next);
    }

    public CommentDto edit(Long commentId, String content, String username) {
        Comment existing = ownComment(commentId, username);
        if (existing.getContent().equals(content.trim())) return toDto(existing, Map.of(), Map.of(), Set.of());
        requireAllowed(content);
        return tx.execute(status -> {
            Comment comment = ownComment(commentId, username);
            comment.setContent(content.trim());
            comment.setEditedAt(LocalDateTime.now());
            return toDto(commentRepository.save(comment), Map.of(), Map.of(), Set.of());
        });
    }

    /** With replies under it the comment becomes a placeholder; otherwise it is removed. */
    @Transactional
    public void delete(Long commentId, String username) {
        Comment comment = ownComment(commentId, username);
        if (comment.getParent() == null && commentRepository.existsByParentId(comment.getId())) {
            comment.setDeleted(true);
            comment.setContent("");
            commentRepository.save(comment);
        } else {
            // Likes, feed lines and notifications of the comment go with it (ON DELETE CASCADE)
            commentRepository.delete(comment);
        }
    }

    @Transactional
    public LikeState like(Long commentId, String username) {
        User user = userLookup.require(username);
        Comment comment = visibleComment(commentId);
        if (likeRepository.findByUserIdAndCommentId(user.getId(), commentId).isEmpty()) {
            likeRepository.save(new CommentLike(user, comment));
            notificationService.notify(comment.getUser(), user, NotificationType.COMMENT_LIKE, comment.getSpot(), comment);
        }
        return new LikeState(true, likeRepository.countByCommentId(commentId));
    }

    @Transactional
    public LikeState unlike(Long commentId, String username) {
        User user = userLookup.require(username);
        likeRepository.findByUserIdAndCommentId(user.getId(), commentId).ifPresent(likeRepository::delete);
        return new LikeState(false, likeRepository.countByCommentId(commentId));
    }

    // --- helpers ---

    private void requireAllowed(String content) {
        if (!aiModerationService.isContentAllowed(content)) {
            throw ApiException.contentRejected("text_rejected",
                    "This comment breaks the community rules (spam, inappropriate content or nonsense text).");
        }
    }

    private Comment visibleComment(Long commentId) {
        return commentRepository.findById(commentId)
                .filter(c -> !c.isDeleted() && c.getSpot().isPublic())
                .orElseThrow(() -> ApiException.notFound("Comment"));
    }

    /** Only the author may edit or delete; anyone else gets 403 (admins use the moderation endpoint). */
    private Comment ownComment(Long commentId, String username) {
        User user = userLookup.require(username);
        Comment comment = commentRepository.findById(commentId)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> ApiException.notFound("Comment"));
        if (!Objects.equals(comment.getUser().getId(), user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_owner", "You can only change your own comments");
        }
        return comment;
    }

    static CommentDto toDto(Comment c, Map<Long, Long> likes, Map<Long, Integer> ratingByUser, Set<Long> likedByMe) {
        CommentDto dto = new CommentDto();
        dto.setId(c.getId());
        dto.setParentId(c.getParent() == null ? null : c.getParent().getId());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setEditedAt(c.getEditedAt());
        dto.setDeleted(c.isDeleted());
        dto.setLikeCount(likes.getOrDefault(c.getId(), 0L));
        dto.setLikedByMe(likedByMe.contains(c.getId()));
        if (c.isDeleted()) return dto;

        User author = c.getUser();
        dto.setContent(c.getContent());
        dto.setAuthorDeleted(author.isDeleted());
        if (!author.isDeleted()) {
            dto.setUsername(author.getUsername());
            dto.setAvatarUrl(author.getAvatarUrl());
        }
        dto.setRating(ratingByUser.get(author.getId()));
        return dto;
    }
}
