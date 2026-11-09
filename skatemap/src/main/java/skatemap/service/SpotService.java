package skatemap.service;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import skatemap.exception.ApiException;
import skatemap.dto.SocialDtos.SpotUpdate;
import skatemap.dto.SpotDto;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.ActivityType;
import skatemap.entity.enums.PhotoStatus;
import skatemap.entity.enums.SpotStatus;
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotReportRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.service.ImageModerationService.Verdict;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class SpotService {

    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final RatingRepository ratingRepository;
    private final CommentRepository commentRepository;
    private final SpotReportRepository spotReportRepository;

    private final AiModerationService aiModerationService;
    private final ImageModerationService imageModerationService;
    private final CloudinaryAssets cloudinaryAssets;
    private final SpotListCache spotListCache;
    private final FeedService feedService;
    private final UserLookup userLookup;
    private final TransactionTemplate tx;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Value("${cloudinary.cloud-name:}")
    private String cloudinaryCloudName;

    public SpotService(SpotRepository spotRepository,
                       UserRepository userRepository,
                       RatingRepository ratingRepository,
                       CommentRepository commentRepository,
                       SpotReportRepository spotReportRepository,
                       AiModerationService aiModerationService,
                       ImageModerationService imageModerationService,
                       CloudinaryAssets cloudinaryAssets,
                       SpotListCache spotListCache,
                       FeedService feedService,
                       UserLookup userLookup,
                       PlatformTransactionManager transactionManager) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
        this.spotReportRepository = spotReportRepository;
        this.aiModerationService = aiModerationService;
        this.imageModerationService = imageModerationService;
        this.cloudinaryAssets = cloudinaryAssets;
        this.spotListCache = spotListCache;
        this.feedService = feedService;
        this.userLookup = userLookup;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public SpotDto createSpot(SpotDto spotDto, String username) {
        // Moderate before anything is stored
        String textToAnalyze = spotDto.getName() + " - " + spotDto.getDescription();
        if (!aiModerationService.isContentAllowed(textToAnalyze)) {
            throw ApiException.contentRejected("text_rejected",
                    "This spot breaks the community rules (spam, inappropriate content or nonsense text).");
        }

        String mediaUrl = blankToNull(spotDto.getMediaUrl());
        requireOwnCloudinaryUrl(mediaUrl);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User"));

        if (mediaUrl != null) {
            moderatePhoto(mediaUrl, spotDto, user);
        }

        Spot spot = new Spot();
        spot.setName(spotDto.getName());
        spot.setDescription(spotDto.getDescription());
        spot.setSpotType(spotDto.getSpotType());
        spot.setDifficultyLevel(spotDto.getDifficultyLevel());
        spot.setMediaUrl(mediaUrl);
        spot.setCreatedBy(user);

        Point point = geometryFactory.createPoint(new Coordinate(spotDto.getLongitude(), spotDto.getLatitude()));
        spot.setLocation(point);

        // The spot and its feed line commit together; the AI checks above ran outside the transaction
        SpotDto created = tx.execute(status -> {
            Spot saved = spotRepository.save(spot);
            feedService.record(user, ActivityType.SPOT_CREATED, saved, null, null);
            return mapToDto(saved);
        });
        spotListCache.invalidate();
        return created;
    }

    /**
     * Rejected or unusable photos are deleted from Cloudinary right away (only from the uploader's own
     * folder, so a crafted URL can't delete someone else's photo) and the user is asked for another one.
     */
    private void moderatePhoto(String mediaUrl, SpotDto spotDto, User user) {
        Verdict verdict = imageModerationService.checkUpload(mediaUrl, spotDto.getName(), spotDto.getDescription());
        ApiException rejection = switch (verdict.outcome()) {
            case ALLOW -> null;
            case REJECT -> ApiException.contentRejected("photo_rejected",
                    "This photo isn't allowed (nudity, drugs, violence, ads or personal data). Please choose another one.");
            case UNCLEAR -> ApiException.contentRejected("photo_unclear",
                    "The photo is too dark or blurry to see the spot. Please take another one.");
            case NOT_PLACE -> ApiException.contentRejected("photo_not_place",
                    "The photo has to show the spot itself (not a meme, screenshot or close-up selfie).");
        };
        if (rejection == null) return;
        if (CloudinaryAssets.isInUserFolder(mediaUrl, user.getId())) {
            cloudinaryAssets.destroy(mediaUrl);
        }
        throw rejection;
    }

    /** Nearest first. Two queries: ids from PostGIS, then the spots with their authors in one go. */
    public List<SpotDto> findSpotsNearby(double lat, double lng, double distanceMeters) {
        List<Long> ids = spotRepository.findSpotIdsNearby(lat, lng, distanceMeters);
        if (ids.isEmpty()) return List.of();
        Map<Long, Spot> byId = spotRepository.findAllByIdIn(ids).stream()
                .collect(Collectors.toMap(Spot::getId, s -> s));
        return ids.stream().map(byId::get).filter(Objects::nonNull).map(SpotService::mapToDto).toList();
    }

    /** Served from memory; see {@link SpotListCache}. Hidden spots are left out. */
    public List<SpotDto> getAllSpots() {
        return spotListCache.get(() -> spotRepository.findAllByStatus(SpotStatus.VISIBLE)
                .stream().map(SpotService::mapToDto).toList());
    }

    /** Admin removal (also used by the moderation queue). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSpot(Long spotId, String username) {
        purge(spotId);
    }

    /** The author removes their own spot. */
    @Transactional
    public void deleteOwnSpot(Long spotId, String username) {
        ownSpot(spotId, username);
        purge(spotId);
    }

    /**
     * The author fixes name, description, type or level. Location and photo can't change: they
     * were checked on site when the spot was added.
     */
    public SpotDto updateOwnSpot(Long spotId, SpotUpdate update, String username) {
        ownSpot(spotId, username);
        String textToAnalyze = update.name() + " - " + update.description();
        if (!aiModerationService.isContentAllowed(textToAnalyze)) {
            throw ApiException.contentRejected("text_rejected",
                    "This spot breaks the community rules (spam, inappropriate content or nonsense text).");
        }
        SpotDto updated = tx.execute(status -> {
            Spot spot = ownSpot(spotId, username);
            spot.setName(update.name().trim());
            spot.setDescription(update.description() == null ? null : update.description().trim());
            spot.setSpotType(update.spotType());
            spot.setDifficultyLevel(update.difficultyLevel());
            return mapToDto(spotRepository.save(spot));
        });
        spotListCache.invalidate();
        return updated;
    }

    /** One visible spot (deep links, feed items). */
    @Transactional(readOnly = true)
    public SpotDto getVisibleSpot(Long spotId) {
        return spotRepository.findById(spotId).filter(Spot::isPublic).map(SpotService::mapToDto)
                .orElseThrow(() -> ApiException.notFound("Spot"));
    }

    private Spot ownSpot(Long spotId, String username) {
        User user = userLookup.require(username);
        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> ApiException.notFound("Spot"));
        if (!spot.getCreatedBy().getId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_owner", "You can only change your own spots");
        }
        return spot;
    }

    private void purge(Long spotId) {
        String mediaUrl = spotRepository.findById(spotId).map(Spot::getMediaUrl).orElse(null);
        // Comments, ratings and reports first, because of the foreign keys
        commentRepository.deleteBySpotId(spotId);
        ratingRepository.deleteBySpotId(spotId);
        spotReportRepository.deleteBySpotId(spotId);
        spotRepository.deleteById(spotId);
        spotListCache.invalidate();
        // The photo would otherwise stay public at its URL
        cloudinaryAssets.destroy(mediaUrl);
    }


    /** Only images uploaded to our own Cloudinary account may be attached to a spot. */
    private void requireOwnCloudinaryUrl(String mediaUrl) {
        if (mediaUrl == null) return;
        String prefix = cloudinaryCloudName == null || cloudinaryCloudName.isBlank()
                ? "https://res.cloudinary.com/"
                : "https://res.cloudinary.com/" + cloudinaryCloudName + "/";
        if (!mediaUrl.startsWith(prefix)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "mediaUrl: only images uploaded through the app are allowed");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    // --- HELPER ---
    public static SpotDto mapToDto(Spot spot) {
        SpotDto dto = new SpotDto();
        dto.setId(spot.getId());
        dto.setName(spot.getName());
        dto.setDescription(spot.getDescription());
        dto.setSpotType(spot.getSpotType());
        dto.setDifficultyLevel(spot.getDifficultyLevel());
        // A photo hidden by moderation is never served, even while the spot stays on the map
        dto.setMediaUrl(spot.getPhotoStatus() == PhotoStatus.HIDDEN ? null : spot.getMediaUrl());

        Double cachedRating = spot.getSurfaceRating();
        double rating = cachedRating != null ? cachedRating : 0.0;
        dto.setSurfaceRating(Math.round(rating * 10.0) / 10.0);

        dto.setCreatedBy(spot.getCreatedBy().getUsername());
        if (spot.getLocation() != null) {
            dto.setLatitude(spot.getLocation().getY());
            dto.setLongitude(spot.getLocation().getX());
        }
        return dto;
    }
}
