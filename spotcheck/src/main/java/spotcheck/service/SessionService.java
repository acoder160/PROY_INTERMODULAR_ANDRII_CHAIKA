package spotcheck.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import spotcheck.dto.SocialDtos.UserSummary;
import spotcheck.entity.SessionParticipant;
import spotcheck.entity.SkateSession;
import spotcheck.entity.Spot;
import spotcheck.entity.User;
import spotcheck.entity.enums.ActivityType;
import spotcheck.entity.enums.NotificationType;
import spotcheck.exception.ApiException;
import spotcheck.repository.SessionParticipantRepository;
import spotcheck.repository.SkateSessionRepository;
import spotcheck.repository.SpotRepository;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Planned meet-ups at a spot ("I'll be at MACBA at 18:00, come along"). Anyone can join; whoever
 * joins gets a push about 30 minutes before the start. Times travel as instants (UTC with a Z), so
 * a phone in another time zone shows the right local time.
 */
@Service
public class SessionService {

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

    static final Duration MAX_AHEAD = Duration.ofDays(30);
    /** A session stays listed this long after it started (people are still there). */
    static final Duration SHOWN_AFTER_START = Duration.ofHours(2);
    static final Duration REMIND_BEFORE = Duration.ofMinutes(30);
    /** Sessions a skater can host at once (not finished yet, so still listed on the spot). */
    static final int MAX_ACTIVE_PER_HOST = 5;
    static final int PEOPLE_SHOWN = 6;

    public record SessionItem(Long id, Long spotId, String spotName, Instant startsAt, String note, UserSummary host,
                              long participants, List<UserSummary> people, boolean joinedByMe, boolean hostedByMe) {}

    private final SkateSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final SpotRepository spotRepository;
    private final UserLookup userLookup;
    private final AiModerationService aiModerationService;
    private final FeedService feedService;
    private final NotificationService notificationService;
    private final TransactionTemplate tx;

    public SessionService(SkateSessionRepository sessionRepository, SessionParticipantRepository participantRepository,
                          SpotRepository spotRepository, UserLookup userLookup, AiModerationService aiModerationService,
                          FeedService feedService, NotificationService notificationService,
                          PlatformTransactionManager transactionManager) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.spotRepository = spotRepository;
        this.userLookup = userLookup;
        this.aiModerationService = aiModerationService;
        this.feedService = feedService;
        this.notificationService = notificationService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public SessionItem create(String username, Long spotId, Instant startsAt, String rawNote) {
        checkTime(startsAt);
        String note = moderatedNote(rawNote);
        return tx.execute(status -> {
            User host = userLookup.require(username);
            Spot spot = spotRepository.findById(spotId).filter(Spot::isPublic)
                    .orElseThrow(() -> ApiException.notFound("Spot"));
            LocalDateTime activeSince = LocalDateTime.now().minus(SHOWN_AFTER_START);
            if (sessionRepository.countByHostIdAndStartsAtAfter(host.getId(), activeSince) >= MAX_ACTIVE_PER_HOST) {
                throw new ApiException(HttpStatus.CONFLICT, "session_limit",
                        "You already have " + MAX_ACTIVE_PER_HOST + " active sessions");
            }
            SkateSession session = sessionRepository.save(new SkateSession(spot, host, toLocal(startsAt), note));
            participantRepository.save(new SessionParticipant(session, host));
            feedService.record(host, ActivityType.SESSION_CREATED, spot, null, null, session);
            return items(List.of(session), host).get(0);
        });
    }

    @Transactional(readOnly = true)
    public List<SessionItem> upcoming(Long spotId) {
        LocalDateTime since = LocalDateTime.now().minus(SHOWN_AFTER_START);
        return items(sessionRepository.findBySpotIdAndStartsAtAfterOrderByStartsAtAsc(spotId, since),
                userLookup.current().orElse(null));
    }

    /** The sessions a skater hosts or joined that aren't over yet, soonest first (their profile). */
    @Transactional(readOnly = true)
    public List<SessionItem> mine(String username) {
        User user = userLookup.require(username);
        LocalDateTime since = LocalDateTime.now().minus(SHOWN_AFTER_START);
        List<SkateSession> sessions = sessionRepository.findJoinedBy(user.getId(), since).stream()
                .filter(s -> s.getSpot().isPublic())
                .toList();
        return items(sessions, user);
    }

    @Transactional
    public SessionItem join(String username, Long sessionId) {
        User user = userLookup.require(username);
        SkateSession session = openSession(sessionId);
        if (participantRepository.findBySessionIdAndUserId(sessionId, user.getId()).isEmpty()) {
            try {
                participantRepository.saveAndFlush(new SessionParticipant(session, user));
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                throw new ApiException(HttpStatus.CONFLICT, "already_joined", "You already joined this session");
            }
            notificationService.notify(session.getHost(), user, NotificationType.SESSION_JOINED, session.getSpot(), null, session);
        }
        return items(List.of(session), user).get(0);
    }

    /** Leave a session; the host can't leave their own (they cancel it instead). */
    @Transactional
    public SessionItem leave(String username, Long sessionId) {
        User user = userLookup.require(username);
        SkateSession session = sessionRepository.findById(sessionId).orElseThrow(() -> ApiException.notFound("Session"));
        if (session.getHost().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "host_cannot_leave", "Cancel the session instead");
        }
        participantRepository.findBySessionIdAndUserId(sessionId, user.getId()).ifPresent(participantRepository::delete);
        return items(List.of(session), user).get(0);
    }

    /**
     * The host changes the time and/or the note. Everyone who joined is told; a new time also means
     * a new reminder. The AI check of the note runs before the transaction, like on create.
     */
    public SessionItem update(String username, Long sessionId, Instant startsAt, String rawNote) {
        checkTime(startsAt);
        String note = moderatedNote(rawNote);
        return tx.execute(status -> {
            User host = userLookup.require(username);
            SkateSession session = openSession(sessionId);
            requireHost(session, host);
            LocalDateTime newStart = toLocal(startsAt);
            boolean timeChanged = !newStart.equals(session.getStartsAt());
            boolean noteChanged = !java.util.Objects.equals(note, session.getNote());
            if (!timeChanged && !noteChanged) return items(List.of(session), host).get(0);
            session.setStartsAt(newStart);
            session.setNote(note);
            if (timeChanged) session.setRemindedAt(null);
            sessionRepository.save(session);
            for (SessionParticipant p : participantRepository.findBySessionId(session.getId())) {
                notificationService.notify(p.getUser(), host, NotificationType.SESSION_UPDATED, session.getSpot(), null, session);
            }
            return items(List.of(session), host).get(0);
        });
    }

    /**
     * Only the host cancels; participants and feed lines go with it (ON DELETE CASCADE). Those who
     * joined get a notice that points at the spot, since the session itself no longer exists.
     */
    @Transactional
    public void cancel(String username, Long sessionId) {
        User user = userLookup.require(username);
        SkateSession session = sessionRepository.findById(sessionId).orElseThrow(() -> ApiException.notFound("Session"));
        requireHost(session, user);
        boolean upcoming = session.getStartsAt().isAfter(LocalDateTime.now());
        Spot spot = session.getSpot();
        spot.getName(); // loaded now: the notices below are written after the session row is gone
        List<User> joined = participantRepository.findBySessionId(session.getId()).stream()
                .map(SessionParticipant::getUser).toList();
        sessionRepository.delete(session);
        if (upcoming) {
            for (User u : joined) {
                notificationService.notify(u, user, NotificationType.SESSION_CANCELLED, spot, null, null);
            }
        }
    }

    /**
     * Once a minute: sessions starting within the next 30 minutes get one reminder per participant
     * (the host included). {@code reminded_at} makes it happen once, even across restarts.
     */
    @Scheduled(fixedDelayString = "${app.sessions.reminder-interval-ms:60000}", initialDelay = 45000)
    @Transactional
    public int sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<SkateSession> due = sessionRepository.findByRemindedAtIsNullAndStartsAtBetween(now, now.plus(REMIND_BEFORE));
        for (SkateSession session : due) {
            for (SessionParticipant p : participantRepository.findBySessionId(session.getId())) {
                notificationService.remind(p.getUser(), session.getHost(), session.getSpot(), session);
            }
            session.setRemindedAt(now);
        }
        if (!due.isEmpty()) log.info("Sent reminders for {} session(s)", due.size());
        return due.size();
    }

    // --- helpers ---

    private static void checkTime(Instant startsAt) {
        Instant now = Instant.now();
        if (startsAt == null || startsAt.isBefore(now.minus(Duration.ofMinutes(5))) || startsAt.isAfter(now.plus(MAX_AHEAD))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "session_bad_time", "Pick a time between now and 30 days ahead");
        }
    }

    private String moderatedNote(String rawNote) {
        String note = rawNote == null || rawNote.isBlank() ? null : rawNote.trim();
        if (note != null && !aiModerationService.isContentAllowed(note)) {
            throw ApiException.contentRejected("text_rejected",
                    "This note breaks the community rules (spam, inappropriate content or nonsense text).");
        }
        return note;
    }

    private static void requireHost(SkateSession session, User user) {
        if (!session.getHost().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_owner", "Only the host can change or cancel a session");
        }
    }

    private SkateSession openSession(Long sessionId) {
        SkateSession session = sessionRepository.findById(sessionId).orElseThrow(() -> ApiException.notFound("Session"));
        if (session.getStartsAt().isBefore(LocalDateTime.now().minus(SHOWN_AFTER_START)) || !session.getSpot().isPublic()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "session_over", "This session is over");
        }
        return session;
    }

    private List<SessionItem> items(List<SkateSession> sessions, User viewer) {
        if (sessions.isEmpty()) return List.of();
        Map<Long, List<User>> people = new HashMap<>();
        participantRepository.findBySessionIdInOrderByIdAsc(sessions.stream().map(SkateSession::getId).toList())
                .forEach(p -> people.computeIfAbsent(p.getSession().getId(), k -> new ArrayList<>()).add(p.getUser()));
        return sessions.stream().map(s -> {
            List<User> in = people.getOrDefault(s.getId(), List.of());
            boolean joined = viewer != null && in.stream().anyMatch(u -> u.getId().equals(viewer.getId()));
            boolean hosted = viewer != null && s.getHost().getId().equals(viewer.getId());
            return new SessionItem(s.getId(), s.getSpot().getId(), s.getSpot().getName(), toInstant(s.getStartsAt()), s.getNote(),
                    UserSummary.of(s.getHost()), in.size(),
                    in.stream().filter(u -> !u.isDeleted()).limit(PEOPLE_SHOWN).map(UserSummary::of).toList(),
                    joined, hosted);
        }).toList();
    }

    /** The database keeps server-local time (like every other timestamp here). */
    static LocalDateTime toLocal(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }

    static Instant toInstant(LocalDateTime local) {
        return local.atZone(ZoneId.systemDefault()).toInstant();
    }
}
