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
    public RatingDto rateSpot(Long spotId, String username, Integer value) {
        // 1. Validar Usuario y Spot
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new RuntimeException("Spot no encontrado"));

        // 2. Comprobar si ya existe voto (Actualizar vs Crear)
        Rating rating = ratingRepository.findByUserIdAndSpotId(user.getId(), spotId)
                .orElse(new Rating()); // Si no existe, crea uno nuevo vacío

        rating.setUser(user);
        rating.setSpot(spot);
        rating.setValue(value);

        ratingRepository.save(rating);

        // 3. CALCULAR Y ACTUALIZAR LA MEDIA DEL SPOT
        Double average = ratingRepository.getAverageRating(spotId);

        // Redondear a 1 decimal para que quede bonito (ej: 4.5)
        if (average != null) {
            double roundedAvg = Math.round(average * 10.0) / 10.0;
            spot.setSurfaceRating(roundedAvg);
            spotRepository.save(spot); // Guardamos la nueva media en el Spot

            return new RatingDto(value, roundedAvg);
        }

        return new RatingDto(value, 0.0);
    }
}