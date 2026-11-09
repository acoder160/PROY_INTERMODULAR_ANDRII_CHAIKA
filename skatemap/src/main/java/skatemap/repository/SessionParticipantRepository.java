package skatemap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.SessionParticipant;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {

    Optional<SessionParticipant> findBySessionIdAndUserId(Long sessionId, Long userId);

    long countBySessionId(Long sessionId);

    /** Everyone in these sessions, with their accounts, in join order. */
    @EntityGraph(attributePaths = "user")
    List<SessionParticipant> findBySessionIdInOrderByIdAsc(Collection<Long> sessionIds);

    @EntityGraph(attributePaths = "user")
    List<SessionParticipant> findBySessionId(Long sessionId);

    @Modifying
    @Query("DELETE FROM SessionParticipant p WHERE p.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
