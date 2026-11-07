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
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

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

    private final AiModerationService aiModerationService;
    private final SpotListCache spotListCache;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Value("${cloudinary.cloud-name:}")
    private String cloudinaryCloudName;

    public SpotService(SpotRepository spotRepository,
                       UserRepository userRepository,
                       RatingRepository ratingRepository,
                       CommentRepository commentRepository,
                       AiModerationService aiModerationService,
                       SpotListCache spotListCache) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
        this.aiModerationService = aiModerationService;
        this.spotListCache = spotListCache;
    }

    public SpotDto createSpot(SpotDto spotDto, String username) {
        // Moderate before anything is stored
        String textToAnalyze = spotDto.getName() + " - " + spotDto.getDescription();
        if (!aiModerationService.isContentAllowed(textToAnalyze)) {
            throw ApiException.contentRejected("This spot breaks the community rules (spam, inappropriate content or nonsense text).");
        }

        requireOwnCloudinaryUrl(spotDto.getMediaUrl());

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User"));

        Spot spot = new Spot();
        spot.setName(spotDto.getName());
        spot.setDescription(spotDto.getDescription());
        spot.setSpotType(spotDto.getSpotType());
        spot.setDifficultyLevel(spotDto.getDifficultyLevel());
        spot.setMediaUrl(spotDto.getMediaUrl());
        spot.setCreatedBy(user);

        Point point = geometryFactory.createPoint(new Coordinate(spotDto.getLongitude(), spotDto.getLatitude()));
        spot.setLocation(point);

        SpotDto created = mapToDto(spotRepository.save(spot));
        spotListCache.invalidate();
        return created;
    }

    public List<SpotDto> findSpotsNearby(double lat, double lng, double distanceMeters) {
        return spotRepository.findSpotsNearby(lat, lng, distanceMeters)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    /** Served from memory; see {@link SpotListCache}. */
    public List<SpotDto> getAllSpots() {
        return spotListCache.get(() -> spotRepository.findAll().stream().map(this::mapToDto).toList());
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSpot(Long spotId, String username) {
        // Comments and ratings first, because of the foreign keys
        commentRepository.deleteBySpotId(spotId);
        ratingRepository.deleteBySpotId(spotId);
        spotRepository.deleteById(spotId);
        spotListCache.invalidate();
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
            throw ApiException.contentRejected("This comment breaks the community rules (spam, inappropriate content or nonsense text).");
        }

        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> ApiException.notFound("Spot"));
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
        if (mediaUrl == null || mediaUrl.isBlank()) return;
        String prefix = cloudinaryCloudName == null || cloudinaryCloudName.isBlank()
                ? "https://res.cloudinary.com/"
                : "https://res.cloudinary.com/" + cloudinaryCloudName + "/";
        if (!mediaUrl.startsWith(prefix)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "mediaUrl: only images uploaded through the app are allowed");
        }
    }

    // --- HELPER ---
    private SpotDto mapToDto(Spot spot) {
        SpotDto dto = new SpotDto();
        dto.setId(spot.getId());
        dto.setName(spot.getName());
        dto.setDescription(spot.getDescription());
        dto.setSpotType(spot.getSpotType());
        dto.setDifficultyLevel(spot.getDifficultyLevel());
        dto.setMediaUrl(spot.getMediaUrl());

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