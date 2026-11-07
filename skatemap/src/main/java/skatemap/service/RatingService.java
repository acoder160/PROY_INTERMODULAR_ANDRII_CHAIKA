package skatemap.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import skatemap.exception.ApiException;
import skatemap.dto.RatingDto;
import skatemap.entity.Rating;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.repository.RatingRepository;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.util.Optional;

@Service
public class RatingService {

    private final RatingRepository ratingRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final SpotListCache spotListCache;

    public RatingService(RatingRepository ratingRepository, SpotRepository spotRepository,
                         UserRepository userRepository, SpotListCache spotListCache) {
        this.ratingRepository = ratingRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.spotListCache = spotListCache;
    }

    @Transactional
    public RatingDto addRating(Long spotId, String username, Integer value) {
        // The spot list shows each spot's average, so it must be refreshed
        spotListCache.invalidate();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User"));

        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> ApiException.notFound("Spot"));

        // One rating per user and spot: rating again updates it
        Optional<Rating> existingRating = ratingRepository.findBySpotAndUser(spot, user);

        Rating rating;
        if (existingRating.isPresent()) {
            rating = existingRating.get();
        } else {
            rating = new Rating();
            rating.setSpot(spot);
            rating.setUser(user);
        }

        rating.setValue(value);
        ratingRepository.save(rating);

        // Recompute the cached average on the spot
        Double average = ratingRepository.getAverageRating(spotId);

        if (average != null) {
            double roundedAvg = Math.round(average * 10.0) / 10.0;
            spot.setSurfaceRating(roundedAvg);
            spotRepository.save(spot);

            // Return the new average to the client
            return new RatingDto(value, roundedAvg);
        }

        return new RatingDto(value, 0.0);
    }

    // The current user's previous rating, shown in the rating widget
    public RatingDto getUserRating(Long spotId, String username) {
        Spot spot = spotRepository.findById(spotId).orElse(null);
        User user = userRepository.findByUsername(username).orElse(null);

        if (spot == null || user == null) return new RatingDto(0, 0.0);

        return ratingRepository.findBySpotAndUser(spot, user)
                .map(r -> new RatingDto(r.getValue(), 0.0)) // average not needed here
                .orElse(new RatingDto(0, 0.0));
    }
}