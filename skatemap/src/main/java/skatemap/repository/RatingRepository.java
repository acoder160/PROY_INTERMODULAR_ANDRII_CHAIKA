package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import skatemap.entity.Rating;
import skatemap.entity.Spot;
import skatemap.entity.User;

import java.util.Optional;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    // Buscar si este usuario ya votó este spot
    Optional<Rating> findBySpotAndUser(Spot spot, User user);

    // Calcular la media de estrellas directamente en SQL (muy rápido)
    @Query("SELECT AVG(r.value) FROM Rating r WHERE r.spot.id = :spotId")
    Double getAverageRating(@Param("spotId") Long spotId);
}