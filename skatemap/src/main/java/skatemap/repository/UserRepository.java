package skatemap.repository;

import skatemap.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Spring crea la consulta SQL automáticamente por el nombre del método
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);

    // Para comprobar si ya existe al registrarse
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);
}