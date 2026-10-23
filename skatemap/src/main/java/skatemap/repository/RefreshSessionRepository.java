package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.RefreshSession;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshSessionRepository extends JpaRepository<RefreshSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM RefreshSession s JOIN FETCH s.user WHERE s.tokenHash = :tokenHash")
    Optional<RefreshSession> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    List<RefreshSession> findByFamilyId(UUID familyId);

    List<RefreshSession> findByUserId(Long userId);
}
