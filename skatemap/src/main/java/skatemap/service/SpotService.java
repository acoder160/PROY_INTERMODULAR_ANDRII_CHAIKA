package skatemap.service;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.dto.CommentDto;
import skatemap.dto.RatingDto;
import skatemap.dto.SpotDto;
import skatemap.entity.Comment;
import skatemap.entity.Rating;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.repository.CommentRepository;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SpotService {

    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final RatingRepository ratingRepository;
    private final CommentRepository commentRepository;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    public SpotService(SpotRepository spotRepository,
                       UserRepository userRepository,
                       RatingRepository ratingRepository,
                       CommentRepository commentRepository) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.ratingRepository = ratingRepository;
        this.commentRepository = commentRepository;
    }

    public SpotDto createSpot(SpotDto spotDto, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Spot spot = new Spot();
        spot.setName(spotDto.getName());
        spot.setDescription(spotDto.getDescription());
        spot.setSpotType(spotDto.getSpotType());
        spot.setDifficultyLevel(spotDto.getDifficultyLevel());
        spot.setCreatedBy(user);

        Point point = geometryFactory.createPoint(new Coordinate(spotDto.getLongitude(), spotDto.getLatitude()));
        spot.setLocation(point);

        return mapToDto(spotRepository.save(spot));
    }

    public List<SpotDto> findSpotsNearby(double lat, double lng, double distanceMeters) {
        return spotRepository.findSpotsNearby(lat, lng, distanceMeters)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public List<SpotDto> getAllSpots() {
        return spotRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // VALORACIONES (RATINGS)

    @Transactional
    public void addRating(Long spotId, int value, String username) {
        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> new RuntimeException("Spot no encontrado"));
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User no encontrado"));

        Optional<Rating> existingRating = ratingRepository.findBySpotAndUser(spot, user);

        if (existingRating.isPresent()) {
            throw new RuntimeException("El usuario ya ha valorado este spot");
        }

        Rating rating = new Rating();
        rating.setSpot(spot);
        rating.setUser(user);
        rating.setValue(value);
        ratingRepository.save(rating);

        Double newAverage = ratingRepository.getAverageRating(spotId);
        spot.setSurfaceRating(newAverage != null ? newAverage : 0.0);
        spotRepository.save(spot);
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
        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> new RuntimeException("Spot no encontrado"));
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User no encontrado"));

        Comment comment = new Comment();
        comment.setSpot(spot);
        comment.setUser(user);
        comment.setContent(content);
        commentRepository.save(comment);

    }

    public List<CommentDto> getCommentsBySpot(Long spotId) {
        return commentRepository.findBySpotIdOrderByCreatedAtDesc(spotId).stream()
                .map(c -> {
                    CommentDto dto = new CommentDto();
                    dto.setId(c.getId());

                    dto.setContent(c.getContent());

                    dto.setUsername(c.getUser().getUsername());
                    dto.setCreatedAt(c.getCreatedAt());

                    ratingRepository.findBySpotAndUser(c.getSpot(), c.getUser())
                            .ifPresent(r -> dto.setRating(r.getValue()));

                    return dto;
                }).collect(Collectors.toList());
    }

    // --- HELPER ---
    private SpotDto mapToDto(Spot spot) {
        SpotDto dto = new SpotDto();
        dto.setId(spot.getId());
        dto.setName(spot.getName());
        dto.setDescription(spot.getDescription());
        dto.setSpotType(spot.getSpotType());
        dto.setDifficultyLevel(spot.getDifficultyLevel());

        double rating = spot.getSurfaceRating() != null ? spot.getSurfaceRating() : 0.0;
        dto.setSurfaceRating(Math.round(rating * 10.0) / 10.0);

        dto.setCreatedBy(spot.getCreatedBy().getUsername());
        if (spot.getLocation() != null) {
            dto.setLatitude(spot.getLocation().getY());
            dto.setLongitude(spot.getLocation().getX());
        }
        return dto;
    }
}