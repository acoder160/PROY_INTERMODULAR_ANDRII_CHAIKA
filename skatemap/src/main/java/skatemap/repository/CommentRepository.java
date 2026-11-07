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

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM #{#entityName} e WHERE e.spot.id = :spotId")
    void deleteBySpotId(@org.springframework.data.repository.query.Param("spotId") Long spotId);

}