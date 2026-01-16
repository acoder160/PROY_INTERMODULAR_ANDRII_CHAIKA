package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import skatemap.entity.Rating;

import java.util.Optional;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    // Buscar si un usuario específico ya votó en un spot específico
    Optional<Rating> findByUserIdAndSpotId(Long userId, Long spotId);

    // CALCULAR PROMEDIO:
    // Consulta personalizada (JPQL) para obtener la media de estrellas de un spot.
    // Devuelve un Double (ej: 4.5), si es null devuelve 0.0
    @Query("SELECT COALESCE(AVG(r.value), 0.0) FROM Rating r WHERE r.spot.id = :spotId")
    Double getAverageRatingForSpot(@Param("spotId") Long spotId);
}