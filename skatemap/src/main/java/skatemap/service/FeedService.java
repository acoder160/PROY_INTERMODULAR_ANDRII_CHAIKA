package skatemap.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.dto.SocialDtos.CursorPage;
import skatemap.dto.SocialDtos.FeedItem;
import skatemap.dto.SocialDtos.SpotSummary;
import skatemap.dto.SocialDtos.UserSummary;
import skatemap.entity.Activity;
import skatemap.entity.Comment;
import skatemap.entity.SkateSession;
import skatemap.dto.SocialDtos.SessionRef;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.ActivityType;
import skatemap.entity.enums.SpotStatus;
import skatemap.repository.ActivityRepository;

import java.util.List;

/**
 * Activity feed, fan-out on read: each action is written once (one row in {@code activities}) and
 * the feed is a query over the people you follow. Fan-out on write (copying every action into each
 * follower's inbox) only pays off with accounts followed by huge numbers of people. At this scale it
 * would add writes and storage for nothing, and a read stays one indexed query.
 */
@Service
public class FeedService {

    static final int PAGE_SIZE = 20;

    private final ActivityRepository activityRepository;
    private final UserLookup userLookup;

    public FeedService(ActivityRepository activityRepository, UserLookup userLookup) {
        this.activityRepository = activityRepository;
        this.userLookup = userLookup;
    }

    /** Called inside the transaction of the action itself. */
    public void record(User actor, ActivityType type, Spot spot, Comment comment, Integer rating) {
        record(actor, type, spot, comment, rating, null);
    }

    public void record(User actor, ActivityType type, Spot spot, Comment comment, Integer rating, SkateSession session) {
        Activity activity = new Activity(actor, type, spot, comment, rating == null ? null : rating.shortValue());
        activity.setSession(session);
        activityRepository.save(activity);
    }

    static SessionRef sessionRef(SkateSession session) {
        return session == null ? null : new SessionRef(session.getId(), SessionService.toInstant(session.getStartsAt()));
    }

    @Transactional(readOnly = true)
    public CursorPage<FeedItem> feed(String username, Long before) {
        User me = userLookup.require(username);
        List<Activity> rows = activityRepository.feed(me.getId(), NotificationService.cursor(before),
                SpotStatus.VISIBLE, PageRequest.of(0, PAGE_SIZE));
        List<FeedItem> items = rows.stream().map(a -> new FeedItem(a.getId(), a.getType(),
                UserSummary.of(a.getActor()), SpotSummary.of(a.getSpot()),
                a.getComment() == null ? null : NotificationService.snippet(a.getComment().getContent()),
                a.getRating(), sessionRef(a.getSession()), a.getCreatedAt())).toList();
        Long next = rows.size() == PAGE_SIZE ? rows.get(rows.size() - 1).getId() : null;
        return new CursorPage<>(items, next);
    }
}
