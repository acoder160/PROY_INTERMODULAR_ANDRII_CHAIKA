package spotcheck.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spotcheck.dto.SocialDtos.FollowState;
import spotcheck.dto.SocialDtos.Me;
import spotcheck.dto.SocialDtos.Profile;
import spotcheck.dto.SocialDtos.ProfileUpdate;
import spotcheck.dto.SocialDtos.UserListItem;
import spotcheck.dto.SpotDto;
import spotcheck.entity.Follow;
import spotcheck.entity.User;
import spotcheck.entity.enums.NotificationType;
import spotcheck.entity.enums.SpotStatus;
import spotcheck.exception.ApiException;
import spotcheck.repository.ActivityRepository;
import spotcheck.repository.CommentLikeRepository;
import spotcheck.repository.CommentRepository;
import spotcheck.repository.FavoriteRepository;
import spotcheck.repository.FollowRepository;
import spotcheck.repository.NotificationRepository;
import spotcheck.repository.PushTokenRepository;
import spotcheck.repository.RatingRepository;
import spotcheck.repository.SpotRepository;
import spotcheck.repository.UserRepository;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Profiles, follows and account self-service. */
@Service
public class ProfileService {

    static final int LIST_PAGE_SIZE = 30;

    private final UserLookup userLookup;
    private final UserRepository userRepository;
    private final SpotRepository spotRepository;
    private final RatingRepository ratingRepository;
    private final CommentRepository commentRepository;
    private final FollowRepository followRepository;
    private final FavoriteRepository favoriteRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final ActivityRepository activityRepository;
    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final NotificationService notificationService;
    private final RefreshTokenService refreshTokenService;
    private final AiModerationService aiModerationService;
    private final ImageModerationService imageModerationService;
    private final CloudinaryAssets cloudinaryAssets;
    private final PasswordEncoder passwordEncoder;
    private final spotcheck.repository.CheckinRepository checkinRepository;
    private final spotcheck.repository.SessionParticipantRepository participantRepository;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;
    private final spotcheck.repository.UserBlockRepository blockRepository;
    private final spotcheck.repository.ContentReportRepository contentReportRepository;

    public ProfileService(UserLookup userLookup, UserRepository userRepository, SpotRepository spotRepository,
                          RatingRepository ratingRepository, CommentRepository commentRepository,
                          FollowRepository followRepository, FavoriteRepository favoriteRepository,
                          CommentLikeRepository commentLikeRepository, ActivityRepository activityRepository,
                          NotificationRepository notificationRepository, PushTokenRepository pushTokenRepository,
                          NotificationService notificationService, RefreshTokenService refreshTokenService,
                          AiModerationService aiModerationService, ImageModerationService imageModerationService,
                          CloudinaryAssets cloudinaryAssets, PasswordEncoder passwordEncoder,
                          spotcheck.repository.CheckinRepository checkinRepository,
                          spotcheck.repository.SessionParticipantRepository participantRepository,
                          org.springframework.context.ApplicationEventPublisher eventPublisher,
                          spotcheck.repository.UserBlockRepository blockRepository,
                          spotcheck.repository.ContentReportRepository contentReportRepository) {
        this.blockRepository = blockRepository;
        this.contentReportRepository = contentReportRepository;
        this.checkinRepository = checkinRepository;
        this.participantRepository = participantRepository;
        this.eventPublisher = eventPublisher;
        this.userLookup = userLookup;
        this.userRepository = userRepository;
        this.spotRepository = spotRepository;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
        this.followRepository = followRepository;
        this.favoriteRepository = favoriteRepository;
        this.commentLikeRepository = commentLikeRepository;
        this.activityRepository = activityRepository;
        this.notificationRepository = notificationRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.notificationService = notificationService;
        this.refreshTokenService = refreshTokenService;
        this.aiModerationService = aiModerationService;
        this.imageModerationService = imageModerationService;
        this.cloudinaryAssets = cloudinaryAssets;
        this.passwordEncoder = passwordEncoder;
    }

    // --- Own account ---

    public Me me(String username) {
        User u = userLookup.require(username);
        return new Me(u.getId(), u.getUsername(), u.getEmail(), u.getRole(), u.getBio(), u.getAvatarUrl(),
                u.getCreatedAt(), userLookup.isDemo(u));
    }

    /**
     * Bio and avatar go through the same moderation as spots. The AI calls happen before anything
     * is written, outside any transaction, so a slow provider never holds a database connection.
     */
    public Me update(String username, ProfileUpdate update) {
        User user = userLookup.require(username);
        userLookup.forbidDemo(user);

        if (update.bio() != null) {
            String bio = update.bio().trim();
            // Admins write their own bio freely: no AI check (the length limit still applies)
            if (!bio.isEmpty() && !user.isAdmin() && !aiModerationService.isContentAllowed(bio)) {
                throw ApiException.contentRejected("text_rejected",
                        "This bio breaks the community rules (spam, inappropriate content or nonsense text).");
            }
            user.setBio(bio.isEmpty() ? null : bio);
        }

        String oldAvatar = user.getAvatarUrl();
        if (update.avatarUrl() != null) {
            String avatar = update.avatarUrl().trim();
            if (avatar.isEmpty()) {
                user.setAvatarUrl(null);
            } else if (!avatar.equals(oldAvatar)) {
                // Only a photo this user uploaded through the app (signed upload into their folder)
                if (!CloudinaryAssets.isInUserFolder(avatar, user.getId())) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "avatarUrl: only photos uploaded through the app are allowed");
                }
                // A face is fine here (unlike a spot photo); only forbidden content is refused
                ImageModerationService.Verdict verdict = imageModerationService.checkUpload(avatar, "profile photo", "");
                if (verdict.outcome() == ImageModerationService.Outcome.REJECT) {
                    cloudinaryAssets.destroy(avatar);
                    throw ApiException.contentRejected("photo_rejected",
                            "This photo isn't allowed (nudity, drugs, violence, ads or personal data). Please choose another one.");
                }
                user.setAvatarUrl(avatar);
            }
        }
        userRepository.save(user);

        if (oldAvatar != null && !oldAvatar.equals(user.getAvatarUrl())
                && CloudinaryAssets.isInUserFolder(oldAvatar, user.getId())) {
            cloudinaryAssets.destroy(oldAvatar);
        }
        return me(user.getUsername());
    }

    /**
     * Deletes the account: personal data and social links go, sessions are revoked, and the row is
     * anonymised. Spots, ratings and comments stay for the community, shown as "deleted user".
     */
    @Transactional
    public void deleteAccount(String username) {
        User user = userLookup.require(username);
        userLookup.forbidDemo(user);
        String avatar = user.getAvatarUrl();

        followRepository.deleteAllOf(user.getId());
        blockRepository.deleteAllOf(user.getId());
        contentReportRepository.deleteAllOf(user.getId());
        favoriteRepository.deleteAllOf(user.getId());
        commentLikeRepository.deleteAllOf(user.getId());
        notificationRepository.deleteAllOf(user.getId());
        activityRepository.deleteAllOf(user.getId());
        pushTokenRepository.deleteAllOf(user.getId());
        java.util.Set<Long> liveSpots = new java.util.LinkedHashSet<>(checkinRepository.activeSpotIds(user.getId()));
        checkinRepository.deleteAllOf(user.getId());
        if (!liveSpots.isEmpty()) {
            eventPublisher.publishEvent(new LiveService.CountsChanged(liveSpots)); // maps drop the badge
        }
        participantRepository.deleteAllOf(user.getId());

        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        String tag = "deleted_" + user.getId();
        user.setUsername(tag);
        user.setEmail(tag + "@spotcheck.invalid");
        user.setPassword(passwordEncoder.encode(Base64.getEncoder().encodeToString(secret)));
        user.setAvatarUrl(null);
        user.setBio(null);
        user.setDeletedAt(LocalDateTime.now());
        // Bumps token_version (kills access tokens) and revokes every refresh session
        refreshTokenService.revokeAll(user);

        if (CloudinaryAssets.isInUserFolder(avatar, user.getId())) cloudinaryAssets.destroy(avatar);
    }

    // --- Public profiles ---

    @Transactional(readOnly = true)
    public Profile profile(String username) {
        User user = userLookup.require(username);
        User viewer = userLookup.current().orElse(null);
        boolean me = viewer != null && viewer.getId().equals(user.getId());
        boolean followed = viewer != null && !me
                && followRepository.existsByFollowerIdAndFolloweeId(viewer.getId(), user.getId());
        return new Profile(user.getUsername(), user.getAvatarUrl(), user.getBio(), user.getCreatedAt(),
                spotRepository.countByCreatedBy_IdAndStatus(user.getId(), SpotStatus.VISIBLE),
                ratingRepository.countByUserId(user.getId()),
                commentRepository.countByUserIdAndDeletedFalse(user.getId()),
                followRepository.countByFolloweeId(user.getId()),
                followRepository.countByFollowerId(user.getId()),
                followed, me, viewer != null && !me && blockRepository.existsByBlockerIdAndBlockedId(viewer.getId(), user.getId()));
    }

    @Transactional(readOnly = true)
    public List<SpotDto> spotsOf(String username, int page) {
        User user = userLookup.require(username);
        return spotRepository.findByCreatedBy_IdAndStatusOrderByIdDesc(user.getId(), SpotStatus.VISIBLE,
                        PageRequest.of(Math.max(page, 0), LIST_PAGE_SIZE))
                .stream().map(SpotService::mapToDto).toList();
    }

    @Transactional(readOnly = true)
    public List<UserListItem> followers(String username, int page) {
        User user = userLookup.require(username);
        List<User> people = followRepository
                .findByFolloweeIdOrderByIdDesc(user.getId(), PageRequest.of(Math.max(page, 0), LIST_PAGE_SIZE))
                .stream().map(Follow::getFollower).toList();
        return withFollowState(people);
    }

    @Transactional(readOnly = true)
    public List<UserListItem> following(String username, int page) {
        User user = userLookup.require(username);
        List<User> people = followRepository
                .findByFollowerIdOrderByIdDesc(user.getId(), PageRequest.of(Math.max(page, 0), LIST_PAGE_SIZE))
                .stream().map(Follow::getFollowee).toList();
        return withFollowState(people);
    }

    private List<UserListItem> withFollowState(List<User> people) {
        User viewer = userLookup.current().orElse(null);
        Set<Long> followed = new HashSet<>();
        List<User> visible = people.stream().filter(u -> !u.isDeleted()).toList();
        if (viewer != null && !visible.isEmpty()) {
            followed.addAll(followRepository.followedAmong(viewer.getId(), visible.stream().map(User::getId).toList()));
        }
        return visible.stream()
                .map(u -> new UserListItem(u.getUsername(), u.getAvatarUrl(), followed.contains(u.getId())))
                .toList();
    }

    // --- Follows ---

    /** Idempotent: following twice is a no-op, not an error. */
    @Transactional
    public FollowState follow(String followerName, String followeeName) {
        User follower = userLookup.require(followerName);
        User followee = userLookup.require(followeeName);
        if (follower.getId().equals(followee.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "cannot_follow_self", "You can't follow yourself");
        }
        if (blockRepository.existsBetween(follower.getId(), followee.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "blocked", "You can't follow this user");
        }
        if (!followRepository.existsByFollowerIdAndFolloweeId(follower.getId(), followee.getId())) {
            followRepository.save(new Follow(follower, followee));
            notificationService.notify(followee, follower, NotificationType.FOLLOW, null, null);
        }
        return new FollowState(true, followRepository.countByFolloweeId(followee.getId()));
    }

    @Transactional
    public FollowState unfollow(String followerName, String followeeName) {
        User follower = userLookup.require(followerName);
        User followee = userLookup.require(followeeName);
        followRepository.findByFollowerIdAndFolloweeId(follower.getId(), followee.getId())
                .ifPresent(followRepository::delete);
        return new FollowState(false, followRepository.countByFolloweeId(followee.getId()));
    }
}
