package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.CommentLike;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CommentLikeRepository extends JpaRepository<CommentLike, Long> {

    interface LikeCount {
        Long getCommentId();
        Long getTotal();
    }

    Optional<CommentLike> findByUserIdAndCommentId(Long userId, Long commentId);

    long countByCommentId(Long commentId);

    /** Like counts of a whole page of comments in one query. */
    @Query("SELECT l.comment.id AS commentId, COUNT(l) AS total FROM CommentLike l "
            + "WHERE l.comment.id IN :ids GROUP BY l.comment.id")
    List<LikeCount> countByCommentIds(@Param("ids") Collection<Long> ids);

    /** Which comments of the page the viewer liked. */
    @Query("SELECT l.comment.id FROM CommentLike l WHERE l.user.id = :userId AND l.comment.id IN :ids")
    List<Long> likedByUser(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);

    @Modifying
    @Query("DELETE FROM CommentLike l WHERE l.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
