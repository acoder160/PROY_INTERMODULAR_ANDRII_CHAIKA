package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import skatemap.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
}
