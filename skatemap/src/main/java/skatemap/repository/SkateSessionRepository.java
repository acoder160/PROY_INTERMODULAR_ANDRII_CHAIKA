package skatemap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import skatemap.entity.SkateSession;

import java.time.LocalDateTime;
import java.util.List;

public interface SkateSessionRepository extends JpaRepository<SkateSession, Long> {

    /** Sessions of a spot that haven't finished yet (started less than {@code since} ago), soonest first. */
    @EntityGraph(attributePaths = "host")
    List<SkateSession> findBySpotIdAndStartsAtAfterOrderByStartsAtAsc(Long spotId, LocalDateTime since);

    /** Sessions starting within the reminder window that haven't been reminded (idx_sessions_reminder). */
    @EntityGraph(attributePaths = {"host", "spot"})
    List<SkateSession> findByRemindedAtIsNullAndStartsAtBetween(LocalDateTime from, LocalDateTime to);

    long countByHostIdAndStartsAtAfter(Long hostId, LocalDateTime after);
}
