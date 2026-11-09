package skatemap.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import skatemap.dto.SpotDto;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.exception.ApiException;
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotReportRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.service.ImageModerationService.Outcome;
import skatemap.service.ImageModerationService.Verdict;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SpotServiceMediaUrlTest {

    private static final String OWN_URL = "https://res.cloudinary.com/skatecloud/image/upload/v1/skatemap_spots/u1/a.jpg";

    private SpotRepository spotRepository;
    private ImageModerationService imageModeration;
    private CloudinaryAssets cloudinaryAssets;
    private SpotService spotService;

    @BeforeEach
    void setUp() {
        spotRepository = mock(SpotRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        AiModerationService moderation = mock(AiModerationService.class);
        when(moderation.isContentAllowed(any())).thenReturn(true);
        imageModeration = mock(ImageModerationService.class);
        when(imageModeration.checkUpload(any(), any(), any())).thenReturn(new Verdict(Outcome.ALLOW, null, ""));
        cloudinaryAssets = mock(CloudinaryAssets.class);

        User user = new User();
        user.setId(1L);
        user.setUsername("skater");
        when(userRepository.findByUsername("skater")).thenReturn(Optional.of(user));
        when(spotRepository.save(any(Spot.class))).thenAnswer(inv -> inv.getArgument(0));

        spotService = new SpotService(spotRepository, userRepository,
                mock(RatingRepository.class), mock(CommentRepository.class), mock(SpotReportRepository.class),
                moderation, imageModeration, cloudinaryAssets, new SpotListCache());
        ReflectionTestUtils.setField(spotService, "cloudinaryCloudName", "skatecloud");
    }

    @Test
    void acceptsImagesFromOwnCloudinaryAccount() {
        spotService.createSpot(spot(OWN_URL), "skater");
        verify(spotRepository).save(any(Spot.class));
        verify(imageModeration).checkUpload(eq(OWN_URL), any(), any());
    }

    @Test
    void acceptsSpotWithoutImage() {
        spotService.createSpot(spot(null), "skater");
        verify(spotRepository).save(any(Spot.class));
        verifyNoInteractions(imageModeration);
    }

    @Test
    void rejectsForeignImageUrls() {
        for (String url : new String[]{
                "https://evil.example/tracker.png",
                "https://res.cloudinary.com/someone-else/image/upload/x.jpg",
                "http://res.cloudinary.com/skatecloud/image/upload/x.jpg",
                "javascript:alert(1)"}) {
            ApiException ex = assertThrows(ApiException.class, () -> spotService.createSpot(spot(url), "skater"), url);
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }
        verify(spotRepository, never()).save(any());
        verifyNoInteractions(imageModeration); // foreign URLs are never sent to the AI
    }

    @Test
    void rejectedPhotoIsDeletedAndNotSaved() {
        when(imageModeration.checkUpload(any(), any(), any())).thenReturn(new Verdict(Outcome.REJECT, "drugs", ""));
        ApiException ex = assertThrows(ApiException.class, () -> spotService.createSpot(spot(OWN_URL), "skater"));
        assertEquals("photo_rejected", ex.getCode());
        verify(cloudinaryAssets).destroy(OWN_URL);
        verify(spotRepository, never()).save(any());
    }

    @Test
    void unusablePhotoAsksForAnotherOne() {
        when(imageModeration.checkUpload(any(), any(), any())).thenReturn(new Verdict(Outcome.UNCLEAR, null, ""));
        ApiException ex = assertThrows(ApiException.class, () -> spotService.createSpot(spot(OWN_URL), "skater"));
        assertEquals("photo_unclear", ex.getCode());
    }

    @Test
    void photoInSomeoneElsesFolderIsNotDeleted() {
        String other = "https://res.cloudinary.com/skatecloud/image/upload/v1/skatemap_spots/u2/b.jpg";
        when(imageModeration.checkUpload(any(), any(), any())).thenReturn(new Verdict(Outcome.NOT_PLACE, null, ""));
        ApiException ex = assertThrows(ApiException.class, () -> spotService.createSpot(spot(other), "skater"));
        assertEquals("photo_not_place", ex.getCode());
        verify(cloudinaryAssets, never()).destroy(any());
    }

    private static SpotDto spot(String mediaUrl) {
        SpotDto dto = new SpotDto();
        dto.setName("Plaza");
        dto.setDescription("Ledges");
        dto.setLatitude(40.4);
        dto.setLongitude(-3.7);
        dto.setSpotType(SpotType.STREET);
        dto.setDifficultyLevel(DifficultyLevel.BEGINNER);
        dto.setMediaUrl(mediaUrl);
        return dto;
    }
}
