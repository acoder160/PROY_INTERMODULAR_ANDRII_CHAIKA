package spotcheck.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import spotcheck.dto.SocialDtos.FollowState;
import spotcheck.entity.Follow;
import spotcheck.entity.User;
import spotcheck.entity.enums.NotificationType;
import spotcheck.exception.ApiException;
import spotcheck.repository.*;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Follow rules in isolation: no self-follow, idempotent follow, counters, notification only once. */
class FollowServiceTest {

    private UserLookup userLookup;
    private FollowRepository followRepository;
    private NotificationService notificationService;
    private ProfileService service;
    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        userLookup = mock(UserLookup.class);
        followRepository = mock(FollowRepository.class);
        notificationService = mock(NotificationService.class);
        service = new ProfileService(userLookup, mock(UserRepository.class), mock(SpotRepository.class),
                mock(RatingRepository.class), mock(CommentRepository.class), followRepository,
                mock(FavoriteRepository.class), mock(CommentLikeRepository.class), mock(ActivityRepository.class),
                mock(NotificationRepository.class), mock(PushTokenRepository.class), notificationService,
                mock(RefreshTokenService.class), mock(AiModerationService.class), mock(ImageModerationService.class),
                mock(CloudinaryAssets.class), mock(PasswordEncoder.class), mock(CheckinRepository.class),
                mock(SessionParticipantRepository.class),
                mock(org.springframework.context.ApplicationEventPublisher.class),
                mock(spotcheck.repository.UserBlockRepository.class),
                mock(spotcheck.repository.ContentReportRepository.class));
        alice = user(1L, "alice");
        bob = user(2L, "bob");
        when(userLookup.require("alice")).thenReturn(alice);
        when(userLookup.require("bob")).thenReturn(bob);
    }

    private static User user(long id, String name) {
        User u = new User();
        u.setId(id);
        u.setUsername(name);
        return u;
    }

    @Test
    void cannotFollowYourself() {
        ApiException e = assertThrows(ApiException.class, () -> service.follow("alice", "alice"));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        verify(followRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void followCreatesRowNotifiesAndReturnsCounter() {
        when(followRepository.existsByFollowerIdAndFolloweeId(1L, 2L)).thenReturn(false);
        when(followRepository.countByFolloweeId(2L)).thenReturn(1L);

        FollowState state = service.follow("alice", "bob");

        assertTrue(state.following());
        assertEquals(1L, state.followers());
        verify(followRepository).save(any(Follow.class));
        verify(notificationService).notify(bob, alice, NotificationType.FOLLOW, null, null);
    }

    @Test
    void followingTwiceIsANoOp() {
        when(followRepository.existsByFollowerIdAndFolloweeId(1L, 2L)).thenReturn(true);
        when(followRepository.countByFolloweeId(2L)).thenReturn(1L);

        FollowState state = service.follow("alice", "bob");

        assertTrue(state.following());
        verify(followRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void unfollowDeletesRowAndIsSafeWhenNotFollowing() {
        Follow f = new Follow(alice, bob);
        when(followRepository.findByFollowerIdAndFolloweeId(1L, 2L)).thenReturn(Optional.of(f), Optional.empty());
        when(followRepository.countByFolloweeId(2L)).thenReturn(0L);

        assertFalse(service.unfollow("alice", "bob").following());
        verify(followRepository).delete(f);

        assertFalse(service.unfollow("alice", "bob").following());
        verify(followRepository, times(1)).delete(any());
    }
}
