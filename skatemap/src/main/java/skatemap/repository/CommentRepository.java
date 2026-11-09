package skatemap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import skatemap.entity.Comment;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    /** Newest first, with the author loaded in the same query. */
    @EntityGraph(attributePaths = "user")
    List<Comment> findBySpotIdOrderByCreatedAtDesc(Long spotId);

    long countBySpotId(Long spotId);

    /** One page of top-level comments, newest first (keyset on id; idx_comments_spot_toplevel). */
    @EntityGraph(attributePaths = "user")
    List<Comment> findBySpotIdAndParentIsNullAndIdLessThanOrderByIdDesc(Long spotId, Long before,
                                                                          org.springframework.data.domain.Pageable pageable);

    /** Replies of a page of comments, oldest first, so a thread reads top to bottom. */
    @EntityGraph(attributePaths = "user")
    List<Comment> findByParentIdInOrderByIdAsc(java.util.Collection<Long> parentIds);

    boolean existsByParentId(Long parentId);

    long countByUserIdAndDeletedFalse(Long userId);

    interface SpotCount {
        Long getSpotId();
        Long getTotal();
    }

    /** Comment count of several spots in one query (admin queue). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT c.spot.id AS spotId, COUNT(c) AS total FROM Comment c WHERE c.spot.id IN :ids GROUP BY c.spot.id")
    List<SpotCount> countBySpotIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM #{#entityName} e WHERE e.spot.id = :spotId")
    void deleteBySpotId(@org.springframework.data.repository.query.Param("spotId") Long spotId);

}