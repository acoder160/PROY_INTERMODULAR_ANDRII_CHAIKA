package skatemap.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

    public RatingService(RatingRepository ratingRepository, SpotRepository spotRepository, UserRepository userRepository) {
        this.ratingRepository = ratingRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public RatingDto addRating(Long spotId, String username, Integer value) {
        // 1. Validar Usuario y Spot
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new RuntimeException("Spot no encontrado"));

        // 2. Comprobar si ya existe voto (CORREGIDO: Usamos findBySpotAndUser)
        // Spring Data JPA espera los objetos entidad, no los IDs sueltos
        Optional<Rating> existingRating = ratingRepository.findBySpotAndUser(spot, user);

        Rating rating;
        if (existingRating.isPresent()) {
            // Si ya votó, actualizamos el existente
            rating = existingRating.get();
        } else {
            // Si es nuevo
            rating = new Rating();
            rating.setSpot(spot);
            rating.setUser(user);
        }

        rating.setValue(value);
        ratingRepository.save(rating);

        // 3. CALCULAR Y ACTUALIZAR LA MEDIA
        Double average = ratingRepository.getAverageRating(spotId);

        if (average != null) {
            double roundedAvg = Math.round(average * 10.0) / 10.0;
            spot.setSurfaceRating(roundedAvg);
            spotRepository.save(spot);

            // Devolvemos el DTO con la nueva media
            return new RatingDto(value, roundedAvg);
        }

        return new RatingDto(value, 0.0);
    }

    // Método extra para saber mi voto anterior (necesario para el frontend)
    public RatingDto getUserRating(Long spotId, String username) {
        Spot spot = spotRepository.findById(spotId).orElse(null);
        User user = userRepository.findByUsername(username).orElse(null);

        if (spot == null || user == null) return new RatingDto(0, 0.0);

        return ratingRepository.findBySpotAndUser(spot, user)
                .map(r -> new RatingDto(r.getValue(), 0.0)) // La media no importa aquí
                .orElse(new RatingDto(0, 0.0));
    }
}