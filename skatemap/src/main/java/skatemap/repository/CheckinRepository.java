package skatemap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.Checkin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CheckinRepository extends JpaRepository<Checkin, Long> {

    interface SpotCount {
        Long getSpotId();
        Long getTotal();
    }

    /** The skater's current check-in (at most one: uk_checkins_active_user). */
    @EntityGraph(attributePaths = "spot")
    Optional<Checkin> findByUserIdAndEndedAtIsNull(Long userId);

    /** Skaters at each spot right now; served by idx_checkins_active_spot. */
    @Query("SELECT c.spot.id AS spotId, COUNT(c) AS total FROM Checkin c "
            + "WHERE c.endedAt IS NULL AND c.expiresAt > :now AND c.spot.status = skatemap.entity.enums.SpotStatus.VISIBLE "
            + "GROUP BY c.spot.id")
    List<SpotCount> liveCounts(@Param("now") LocalDateTime now);

    @Query("SELECT COUNT(c) FROM Checkin c WHERE c.spot.id = :spotId AND c.endedAt IS NULL AND c.expiresAt > :now")
    long liveCount(@Param("spotId") Long spotId, @Param("now") LocalDateTime now);

    /** Who is at the spot now, newest first. */
    @Query("SELECT c FROM Checkin c JOIN FETCH c.user "
            + "WHERE c.spot.id = :spotId AND c.endedAt IS NULL AND c.expiresAt > :now ORDER BY c.id DESC")
    List<Checkin> liveAt(@Param("spotId") Long spotId, @Param("now") LocalDateTime now);

    /** Check-ins past their two hours that nobody closed; the expiry job ends them. */
    @EntityGraph(attributePaths = "spot")
    List<Checkin> findByEndedAtIsNullAndExpiresAtLessThanEqual(LocalDateTime now);

    /** Spots where this user currently has an open check-in (to refresh their counts on account deletion). */
    @Query("SELECT c.spot.id FROM Checkin c WHERE c.user.id = :userId AND c.endedAt IS NULL")
    List<Long> activeSpotIds(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM Checkin c WHERE c.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
