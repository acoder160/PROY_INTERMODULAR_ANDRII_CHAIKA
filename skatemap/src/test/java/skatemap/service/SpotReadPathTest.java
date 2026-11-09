package skatemap.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import skatemap.dto.CommentDto;
import skatemap.entity.Comment;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.repository.CommentRepository;
import skatemap.entity.enums.SpotStatus;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotReportRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SpotReadPathTest {

    private SpotRepository spotRepository;
    private CommentRepository commentRepository;
    private RatingRepository ratingRepository;
    private SpotListCache cache;
    private SpotService service;

    @BeforeEach
    void setUp() {
        spotRepository = mock(SpotRepository.class);
        commentRepository = mock(CommentRepository.class);
        ratingRepository = mock(RatingRepository.class);
        cache = new SpotListCache();
        service = new SpotService(spotRepository, mock(UserRepository.class), ratingRepository,
                commentRepository, mock(SpotReportRepository.class), mock(AiModerationService.class),
                mock(ImageModerationService.class), mock(CloudinaryAssets.class), cache,
                mock(FeedService.class), mock(UserLookup.class), mock(org.springframework.transaction.PlatformTransactionManager.class));
        when(spotRepository.findAllByStatus(SpotStatus.VISIBLE)).thenReturn(List.of(spot(1L), spot(2L)));
    }

    @AfterEach
    void clearTransactionState() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void spotListIsLoadedOnceAndServedFromMemory() {
        for (int i = 0; i < 100; i++) {
            assertEquals(2, service.getAllSpots().size());
        }
        verify(spotRepository, times(1)).findAllByStatus(SpotStatus.VISIBLE);
    }

    @Test
    void invalidationReloadsTheList() {
        service.getAllSpots();
        cache.invalidate();
        service.getAllSpots();
        verify(spotRepository, times(2)).findAllByStatus(SpotStatus.VISIBLE);
    }

    @Test
    void insideATransactionTheCacheIsDroppedOnlyAfterCommit() {
        service.getAllSpots();
        TransactionSynchronizationManager.initSynchronization();

        cache.invalidate();
        service.getAllSpots(); // before commit: still the cached list
        verify(spotRepository, times(1)).findAllByStatus(SpotStatus.VISIBLE);

        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }
        service.getAllSpots();
        verify(spotRepository, times(2)).findAllByStatus(SpotStatus.VISIBLE);
    }

    @Test
    void cachedListCannotBeModifiedByCallers() {
        assertThrows(UnsupportedOperationException.class, () -> service.getAllSpots().clear());
    }

    private static Spot spot(Long id) {
        Spot spot = new Spot();
        spot.setId(id);
        spot.setName("Spot " + id);
        spot.setCreatedBy(user(1L, "creator"));
        return spot;
    }

    private static User user(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setUsername(name);
        return user;
    }

    private static Comment comment(Long id, User author) {
        Comment comment = new Comment();
        comment.setId(id);
        comment.setUser(author);
        comment.setContent("nice");
        return comment;
    }

    private static RatingRepository.UserRating rating(Long userId, int value) {
        return new RatingRepository.UserRating() {
            public Long getUserId() { return userId; }
            public Integer getValue() { return value; }
        };
    }
}
