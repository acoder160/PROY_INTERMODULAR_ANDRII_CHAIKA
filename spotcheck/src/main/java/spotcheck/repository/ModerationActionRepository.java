package spotcheck.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import spotcheck.entity.ModerationAction;

@Repository
public interface ModerationActionRepository extends JpaRepository<ModerationAction, Long> {
}
