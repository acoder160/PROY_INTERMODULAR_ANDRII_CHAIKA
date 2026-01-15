package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import skatemap.entity.Comment;

public interface CommentRepository extends JpaRepository<Comment, Long> {
}
