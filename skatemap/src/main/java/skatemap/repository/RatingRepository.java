package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import skatemap.entity.Rating;
import skatemap.entity.Spot;
import skatemap.entity.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    /** Who gave which rating on a spot, as a projection (no entities, no lazy loading). */
    interface UserRating {
        Long getUserId();
        Integer getValue();
    }

    Optional<Rating> findBySpotAndUser(Spot spot, User user);

    long countByUserId(Long userId);

    @Query("SELECT r.user.id AS userId, r.value AS value FROM Rating r WHERE r.spot.id = :spotId")
    List<UserRating> findUserRatingsBySpotId(@Param("spotId") Long spotId);

    // Average stars computed in SQL
    @Query("SELECT AVG(r.value) FROM Rating r WHERE r.spot.id = :spotId")
    Double getAverageRating(@Param("spotId") Long spotId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM #{#entityName} e WHERE e.spot.id = :spotId")
    void deleteBySpotId(@org.springframework.data.repository.query.Param("spotId") Long spotId);
}