package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import skatemap.entity.Comment;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    // Busca todos los comentarios asociados a un ID de spot
    // Ordenados por fecha descendente (los más nuevos primero)
    List<Comment> findBySpotIdOrderByCreatedAtDesc(Long spotId);

    // Contar cuántos comentarios tiene un spot
    long countBySpotId(Long spotId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM #{#entityName} e WHERE e.spot.id = :spotId")
    void deleteBySpotId(@org.springframework.data.repository.query.Param("spotId") Long spotId);

}