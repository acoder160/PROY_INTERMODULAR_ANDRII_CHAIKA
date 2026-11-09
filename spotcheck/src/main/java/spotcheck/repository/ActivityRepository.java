package spotcheck.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import spotcheck.entity.Activity;
import spotcheck.entity.enums.SpotStatus;

import java.util.List;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

    /**
     * Feed, fan-out on read: the activity of everyone {@code userId} follows, newest first.
     * Keyset pagination ({@code id < before}) stays fast at any depth, unlike OFFSET, and doesn't
     * skip or repeat items when new ones arrive between pages. Served by idx_activities_actor.
     * Activity on hidden spots or deleted comments is left out.
     */
    @Query("SELECT a FROM Activity a JOIN FETCH a.actor "
            + "LEFT JOIN FETCH a.spot s LEFT JOIN FETCH a.comment c LEFT JOIN FETCH a.session "
            + "WHERE a.actor.id IN (SELECT f.followee.id FROM Follow f WHERE f.follower.id = :userId) "
            + "AND a.id < :before "
            + "AND (s IS NULL OR s.status = :visible) "
            + "AND (c IS NULL OR c.deleted = false) "
            + "ORDER BY a.id DESC")
    List<Activity> feed(@Param("userId") Long userId, @Param("before") Long before,
                        @Param("visible") SpotStatus visible, Pageable pageable);

    /** Throttle: has this actor produced an activity of this type since {@code since}? */
    boolean existsByActorIdAndTypeAndCreatedAtAfter(Long actorId, spotcheck.entity.enums.ActivityType type,
                                                    java.time.LocalDateTime since);

    @Modifying
    @Query("DELETE FROM Activity a WHERE a.actor.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
