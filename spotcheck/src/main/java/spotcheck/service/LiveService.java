package spotcheck.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import spotcheck.config.WebSocketConfig;
import spotcheck.dto.SocialDtos.UserSummary;
import spotcheck.entity.Checkin;
import spotcheck.entity.Spot;
import spotcheck.entity.User;
import spotcheck.entity.enums.ActivityType;
import spotcheck.exception.ApiException;
import spotcheck.entity.enums.NotificationType;
import spotcheck.repository.ActivityRepository;
import spotcheck.repository.CheckinRepository;
import spotcheck.repository.FollowRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import spotcheck.repository.SpotRepository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * "Who is skating where, right now". A check-in is only accepted on site (the phone's GPS within
 * {@link #MAX_DISTANCE_METERS} of the spot) and lasts {@link #DURATION} unless the skater leaves.
 * Every change to a spot's count is pushed to the map over WebSocket, after the transaction commits.
 */
@Service
public class LiveService {

    private static final Logger log = LoggerFactory.getLogger(LiveService.class);

    static final double MAX_DISTANCE_METERS = 300;
    static final Duration DURATION = Duration.ofHours(2);
    /** People shown by name at a spot; the count covers everyone. */
    static final int MAX_LISTED = 20;

    /** One spot's live count, as broadcast on /topic/live and returned by the REST fallback. */
    public record SpotLive(Long spotId, long count) {}

    public record SpotDetail(long count, List<UserSummary> skaters, boolean checkedInHere) {}

    /** Published inside a transaction: these spots' counts changed. */
    public record CountsChanged(Set<Long> spotIds) {}

    private final CheckinRepository checkinRepository;
    private final SpotRepository spotRepository;
    private final UserLookup userLookup;
    private final FeedService feedService;
    private final ApplicationEventPublisher events;
    private final SimpMessagingTemplate broker;
    private final ActivityRepository activityRepository;
    private final FollowRepository followRepository;
    private final NotificationService notificationService;

    /** Followers hear about a check-in at most once per hour per skater, and only the newest ones. */
    static final Duration ANNOUNCE_EVERY = Duration.ofHours(1);
    static final int MAX_FOLLOWERS_NOTIFIED = 200;

    public LiveService(CheckinRepository checkinRepository, SpotRepository spotRepository, UserLookup userLookup,
                       FeedService feedService, ApplicationEventPublisher events, SimpMessagingTemplate broker,
                       ActivityRepository activityRepository, FollowRepository followRepository,
                       NotificationService notificationService) {
        this.activityRepository = activityRepository;
        this.followRepository = followRepository;
        this.notificationService = notificationService;
        this.checkinRepository = checkinRepository;
        this.spotRepository = spotRepository;
        this.userLookup = userLookup;
        this.feedService = feedService;
        this.events = events;
        this.broker = broker;
    }

    @Transactional
    public SpotDetail checkIn(String username, Long spotId, double lat, double lng) {
        User user = userLookup.require(username);
        Spot spot = spotRepository.findById(spotId).filter(Spot::isPublic)
                .orElseThrow(() -> ApiException.notFound("Spot"));
        if (!spotRepository.isWithin(spotId, lat, lng, MAX_DISTANCE_METERS)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "checkin_too_far",
                    "You have to be at the spot (within " + (int) MAX_DISTANCE_METERS + " m) to check in");
        }

        Set<Long> changed = new LinkedHashSet<>();
        Checkin current = checkinRepository.findByUserIdAndEndedAtIsNull(user.getId()).orElse(null);
        if (current != null && current.getSpot().getId().equals(spotId) && current.getExpiresAt().isAfter(LocalDateTime.now())) {
            return detail(spotId, user);  // already here: nothing to do
        }
        if (current != null) {
            current.setEndedAt(LocalDateTime.now());
            // Flush now: the partial unique index allows one active check-in per skater
            checkinRepository.saveAndFlush(current);
            changed.add(current.getSpot().getId());
        }
        try {
            // Flush now: two simultaneous check-ins by one skater hit the partial unique index here
            checkinRepository.saveAndFlush(new Checkin(user, spot, LocalDateTime.now().plus(DURATION)));
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "already_checked_in", "You are already checked in");
        }
        announce(user, spot);
        changed.add(spotId);
        events.publishEvent(new CountsChanged(changed));
        return detail(spotId, user);
    }

    /**
     * Feed line and "X is skating at Y" notification, at most once per hour per skater so hopping
     * between spots doesn't flood anyone's feed or phone.
     */
    private void announce(User user, Spot spot) {
        LocalDateTime since = LocalDateTime.now().minus(ANNOUNCE_EVERY);
        if (activityRepository.existsByActorIdAndTypeAndCreatedAtAfter(user.getId(), ActivityType.CHECKED_IN, since)) {
            return;
        }
        feedService.record(user, ActivityType.CHECKED_IN, spot, null, null);
        for (User follower : followRepository.followersOf(user.getId(), PageRequest.of(0, MAX_FOLLOWERS_NOTIFIED))) {
            notificationService.notify(follower, user, NotificationType.FOLLOWEE_CHECKED_IN, spot, null);
        }
    }

    /** Leave the current spot early. Idempotent. */
    @Transactional
    public void checkOut(String username) {
        User user = userLookup.require(username);
        checkinRepository.findByUserIdAndEndedAtIsNull(user.getId()).ifPresent(c -> {
            c.setEndedAt(LocalDateTime.now());
            checkinRepository.save(c);
            events.publishEvent(new CountsChanged(Set.of(c.getSpot().getId())));
        });
    }

    /** Every spot with someone at it right now (REST fallback and first paint before the socket). */
    @Transactional(readOnly = true)
    public List<SpotLive> counts() {
        return checkinRepository.liveCounts(LocalDateTime.now()).stream()
                .map(c -> new SpotLive(c.getSpotId(), c.getTotal()))
                .toList();
    }

    @Transactional(readOnly = true)
    public SpotDetail at(Long spotId) {
        return detail(spotId, userLookup.current().orElse(null));
    }

    private SpotDetail detail(Long spotId, User viewer) {
        List<Checkin> here = checkinRepository.liveAt(spotId, LocalDateTime.now());
        boolean mine = viewer != null && here.stream().anyMatch(c -> c.getUser().getId().equals(viewer.getId()));
        List<UserSummary> listed = here.stream().limit(MAX_LISTED).map(c -> UserSummary.of(c.getUser())).toList();
        return new SpotDetail(here.size(), listed, mine);
    }

    /** Closes check-ins whose two hours are up, once a minute, and pushes the new counts. */
    @Scheduled(fixedDelayString = "${app.live.expiry-interval-ms:60000}", initialDelay = 30000)
    @Transactional
    public void expireOld() {
        List<Checkin> expired = checkinRepository.findByEndedAtIsNullAndExpiresAtLessThanEqual(LocalDateTime.now());
        if (expired.isEmpty()) return;
        Set<Long> changed = new LinkedHashSet<>();
        for (Checkin c : expired) {
            c.setEndedAt(c.getExpiresAt());
            changed.add(c.getSpot().getId());
        }
        checkinRepository.saveAll(expired);
        events.publishEvent(new CountsChanged(changed));
        log.debug("Expired {} check-in(s)", expired.size());
    }

    /**
     * After commit, so clients never see a count the database rolled back. One message per
     * changed spot, count 0 included so the badge disappears.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void broadcast(CountsChanged event) {
        LocalDateTime now = LocalDateTime.now();
        for (Long spotId : event.spotIds()) {
            broker.convertAndSend(WebSocketConfig.LIVE_TOPIC, new SpotLive(spotId, checkinRepository.liveCount(spotId, now)));
        }
    }
}
