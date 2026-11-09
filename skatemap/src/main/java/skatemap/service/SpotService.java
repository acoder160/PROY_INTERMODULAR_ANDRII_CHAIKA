package skatemap.service;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import skatemap.exception.ApiException;
import skatemap.dto.CommentDto;
import skatemap.dto.RatingDto;
import skatemap.dto.SpotDto;
import skatemap.entity.Comment;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.PhotoStatus;
import skatemap.entity.enums.SpotStatus;
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotReportRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;
import skatemap.service.ImageModerationService.Verdict;

import java.util.List;
import java.util.HashMap;
import java.util.Map;
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
                       SpotListCache spotListCache) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
        this.spotReportRepository = spotReportRepository;
        this.aiModerationService = aiModerationService;
        this.imageModerationService = imageModerationService;
        this.cloudinaryAssets = cloudinaryAssets;
        this.spotListCache = spotListCache;
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

        SpotDto created = mapToDto(spotRepository.save(spot));
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

    public List<SpotDto> findSpotsNearby(double lat, double lng, double distanceMeters) {
        return spotRepository.findSpotsNearby(lat, lng, distanceMeters)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    /** Served from memory; see {@link SpotListCache}. Hidden spots are left out. */
    public List<SpotDto> getAllSpots() {
        return spotListCache.get(() -> spotRepository.findAllByStatus(SpotStatus.VISIBLE)
                .stream().map(this::mapToDto).toList());
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSpot(Long spotId, String username) {
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

    public RatingDto getUserRating(Long spotId, String username) {
        Spot spot = spotRepository.findById(spotId).orElse(null);
        User user = userRepository.findByUsername(username).orElse(null);

        if (spot == null || user == null) return null;

        return ratingRepository.findBySpotAndUser(spot, user)
                .map(r -> {
                    RatingDto dto = new RatingDto();
                    dto.setValue(r.getValue());
                    return dto;
                })
                .orElse(new RatingDto());
    }

    public void addComment(Long spotId, String content, String username) {
        if (!aiModerationService.isContentAllowed(content)) {
            throw ApiException.contentRejected("text_rejected",
                    "This comment breaks the community rules (spam, inappropriate content or nonsense text).");
        }

        Spot spot = spotRepository.findById(spotId)
                .filter(Spot::isPublic)
                .orElseThrow(() -> ApiException.notFound("Spot"));
        User user = userRepository.findByUsername(username).orElseThrow(() -> ApiException.notFound("User"));

        Comment comment = new Comment();
        comment.setSpot(spot);
        comment.setUser(user);
        comment.setContent(content);
        commentRepository.save(comment);
    }

    /**
     * Two queries in total, whatever the number of comments: comments with their authors, and every
     * rating of the spot (to show each author's stars next to their comment).
     */
    public List<CommentDto> getCommentsBySpot(Long spotId) {
        Map<Long, Integer> ratingByUser = new HashMap<>();
        for (RatingRepository.UserRating r : ratingRepository.findUserRatingsBySpotId(spotId)) {
            ratingByUser.put(r.getUserId(), r.getValue());
        }
        return commentRepository.findBySpotIdOrderByCreatedAtDesc(spotId).stream()
                .map(c -> {
                    CommentDto dto = new CommentDto();
                    dto.setId(c.getId());
                    dto.setContent(c.getContent());
                    dto.setUsername(c.getUser().getUsername());
                    dto.setCreatedAt(c.getCreatedAt());
                    dto.setRating(ratingByUser.get(c.getUser().getId()));
                    return dto;
                }).collect(Collectors.toList());
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
    private SpotDto mapToDto(Spot spot) {
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
