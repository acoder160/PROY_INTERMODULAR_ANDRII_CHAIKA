package spotcheck.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import spotcheck.entity.Favorite;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    Optional<Favorite> findByUserIdAndSpotId(Long userId, Long spotId);

    /** Just the ids: the clients load them once and mark the saved spots on the map. */
    @Query("SELECT f.spot.id FROM Favorite f WHERE f.user.id = :userId ORDER BY f.id DESC")
    List<Long> findSpotIdsByUserId(@Param("userId") Long userId);

    @EntityGraph(attributePaths = {"spot", "spot.createdBy"})
    List<Favorite> findByUserIdOrderByIdDesc(Long userId);

    @Modifying
    @Query("DELETE FROM Favorite f WHERE f.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
