package spotcheck.repository;

import spotcheck.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Spring crea la consulta SQL automáticamente por el nombre del metodo
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);

    // Para comprobar si ya existe al registrarse
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);

    // Reputación de denunciantes (decisiones de admin)
    @Modifying
    @Query("UPDATE User u SET u.reportsUpheld = u.reportsUpheld + 1 WHERE u.id IN :ids")
    int incrementReportsUpheld(@Param("ids") Collection<Long> ids);

    @Modifying
    @Query("UPDATE User u SET u.reportsRejected = u.reportsRejected + 1 WHERE u.id IN :ids")
    int incrementReportsRejected(@Param("ids") Collection<Long> ids);
}
