package spotcheck.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import spotcheck.entity.Follow;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    Optional<Follow> findByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    long countByFollowerId(Long followerId);

    long countByFolloweeId(Long followeeId);

    /** People following {@code userId}, newest first. */
    @EntityGraph(attributePaths = "follower")
    List<Follow> findByFolloweeIdOrderByIdDesc(Long userId, Pageable pageable);

    /** People {@code userId} follows, newest first. */
    @EntityGraph(attributePaths = "followee")
    List<Follow> findByFollowerIdOrderByIdDesc(Long userId, Pageable pageable);

    /** Which of {@code candidateIds} the viewer follows (for "Follow / Following" buttons in lists). */
    @Query("SELECT f.followee.id FROM Follow f WHERE f.follower.id = :viewerId AND f.followee.id IN :candidateIds")
    List<Long> followedAmong(@Param("viewerId") Long viewerId, @Param("candidateIds") Collection<Long> candidateIds);

    /** Followers of {@code userId}, for fan-out notifications (callers cap with a Pageable). */
    @Query("SELECT f.follower FROM Follow f WHERE f.followee.id = :userId AND f.follower.deletedAt IS NULL ORDER BY f.id DESC")
    List<spotcheck.entity.User> followersOf(@Param("userId") Long userId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM Follow f WHERE f.follower.id = :userId OR f.followee.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
