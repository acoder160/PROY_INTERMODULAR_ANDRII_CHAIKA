package skatemap.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.dto.SocialDtos.NotificationItem;
import skatemap.dto.SocialDtos.NotificationPage;
import skatemap.dto.SocialDtos.SpotSummary;
import skatemap.dto.SocialDtos.UserSummary;
import skatemap.entity.Comment;
import skatemap.entity.Notification;
import skatemap.entity.Spot;
import skatemap.entity.SkateSession;
import skatemap.entity.User;
import skatemap.entity.enums.NotificationType;
import skatemap.repository.NotificationRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * In-app notifications. The row is written in the caller's transaction (it commits or rolls back
 * with the comment, follow or like that caused it); the push goes out only after the commit, see
 * {@link PushService}.
 */
@Service
public class NotificationService {

    static final int PAGE_SIZE = 30;

    /** Published inside the transaction; PushService picks it up after commit. */
    public record Created(Long notificationId) {}

    private final NotificationRepository notificationRepository;
    private final ApplicationEventPublisher events;
    private final UserLookup userLookup;
    private final skatemap.repository.UserBlockRepository blockRepository;

    public NotificationService(NotificationRepository notificationRepository, ApplicationEventPublisher events,
                               UserLookup userLookup, skatemap.repository.UserBlockRepository blockRepository) {
        this.blockRepository = blockRepository;
        this.notificationRepository = notificationRepository;
        this.events = events;
        this.userLookup = userLookup;
    }

    /** Nobody is notified about their own actions, deleted accounts get nothing. */
    public void notify(User recipient, User actor, NotificationType type, Spot spot, Comment comment) {
        notify(recipient, actor, type, spot, comment, null);
    }

    public void notify(User recipient, User actor, NotificationType type, Spot spot, Comment comment, SkateSession session) {
        if (recipient == null || recipient.getId().equals(actor.getId())) return;
        save(recipient, actor, type, spot, comment, session);
    }

    /** "Your session starts soon": the host gets it too, so self-notifications are allowed here. */
    public void remind(User recipient, User host, Spot spot, SkateSession session) {
        save(recipient, host, NotificationType.SESSION_REMINDER, spot, null, session);
    }

    private void save(User recipient, User actor, NotificationType type, Spot spot, Comment comment, SkateSession session) {
        if (recipient == null || recipient.isDeleted()) return;
        // Someone you blocked cannot reach you, not even with a like
        if (type != NotificationType.SESSION_REMINDER
                && blockRepository.existsByBlockerIdAndBlockedId(recipient.getId(), actor.getId())) return;
        if (type == NotificationType.COMMENT_LIKE && comment != null
                && notificationRepository.existsByRecipientIdAndActorIdAndTypeAndCommentId(
                        recipient.getId(), actor.getId(), type, comment.getId())) {
            return;
        }
        Notification notification = new Notification(recipient, actor, type, spot, comment);
        notification.setSession(session);
        Notification saved = notificationRepository.save(notification);
        events.publishEvent(new Created(saved.getId()));
    }

    @Transactional(readOnly = true)
    public NotificationPage page(String username, Long before) {
        User me = userLookup.require(username);
        List<Notification> rows = notificationRepository.page(me.getId(), cursor(before), PageRequest.of(0, PAGE_SIZE));
        List<NotificationItem> items = rows.stream().map(NotificationService::toItem).toList();
        Long next = rows.size() == PAGE_SIZE ? rows.get(rows.size() - 1).getId() : null;
        return new NotificationPage(items, next, notificationRepository.countByRecipientIdAndReadAtIsNull(me.getId()));
    }

    @Transactional(readOnly = true)
    public long unreadCount(String username) {
        return notificationRepository.countByRecipientIdAndReadAtIsNull(userLookup.require(username).getId());
    }

    @Transactional
    public void markAllRead(String username) {
        notificationRepository.markAllRead(userLookup.require(username).getId(), LocalDateTime.now());
    }

    static NotificationItem toItem(Notification n) {
        Comment c = n.getComment();
        return new NotificationItem(n.getId(), n.getType(), UserSummary.of(n.getActor()), SpotSummary.of(n.getSpot()),
                c == null ? null : c.getId(),
                c == null || c.isDeleted() ? null : snippet(c.getContent()),
                FeedService.sessionRef(n.getSession()), n.getReadAt() != null, n.getCreatedAt());
    }

    static String snippet(String text) {
        if (text == null) return null;
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return oneLine.length() <= 120 ? oneLine : oneLine.substring(0, 117) + "...";
    }

    /** First page: no cursor. */
    static long cursor(Long before) {
        return before == null || before <= 0 ? Long.MAX_VALUE : before;
    }
}
