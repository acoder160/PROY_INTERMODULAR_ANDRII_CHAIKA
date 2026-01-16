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

    // Para contar cuántos comentarios tiene un spot (útil para listas)
    long countBySpotId(Long spotId);
}