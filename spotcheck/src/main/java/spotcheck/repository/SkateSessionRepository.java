package spotcheck.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import spotcheck.entity.SkateSession;

import java.time.LocalDateTime;
import java.util.List;

public interface SkateSessionRepository extends JpaRepository<SkateSession, Long> {

    /** Sessions of a spot that haven't finished yet (started less than {@code since} ago), soonest first. */
    @EntityGraph(attributePaths = "host")
    List<SkateSession> findBySpotIdAndStartsAtAfterOrderByStartsAtAsc(Long spotId, LocalDateTime since);

    /** Sessions starting within the reminder window that haven't been reminded (idx_sessions_reminder). */
    @EntityGraph(attributePaths = {"host", "spot"})
    List<SkateSession> findByRemindedAtIsNullAndStartsAtBetween(LocalDateTime from, LocalDateTime to);

    /** Sessions the user takes part in (hosts are participants too) that started after {@code since}. */
    @Query("SELECT s FROM SkateSession s JOIN FETCH s.host JOIN FETCH s.spot WHERE s.startsAt > :since"
            + " AND EXISTS (SELECT 1 FROM SessionParticipant p WHERE p.session = s AND p.user.id = :userId)"
            + " ORDER BY s.startsAt ASC")
    List<SkateSession> findJoinedBy(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    long countByHostIdAndStartsAtAfter(Long hostId, LocalDateTime after);
}
