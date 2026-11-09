package skatemap.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.UserBlock;

import java.util.List;
import java.util.Optional;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    Optional<UserBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    /** Either of the two blocked the other: they must not interact. */
    @Query("SELECT COUNT(b) > 0 FROM UserBlock b WHERE (b.blocker.id = :a AND b.blocked.id = :b) OR (b.blocker.id = :b AND b.blocked.id = :a)")
    boolean existsBetween(@Param("a") Long a, @Param("b") Long b);

    /** Ids the user has blocked (a short list; used to filter comments). */
    @Query("SELECT b.blocked.id FROM UserBlock b WHERE b.blocker.id = :userId")
    List<Long> blockedIds(@Param("userId") Long userId);

    @EntityGraph(attributePaths = "blocked")
    List<UserBlock> findByBlockerIdOrderByIdDesc(Long blockerId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM UserBlock b WHERE b.blocker.id = :userId OR b.blocked.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
