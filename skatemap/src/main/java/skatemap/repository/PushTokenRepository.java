package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.PushToken;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {

    Optional<PushToken> findByToken(String token);

    List<PushToken> findByUserId(Long userId);

    @Modifying
    @Query("DELETE FROM PushToken p WHERE p.token IN :tokens")
    int deleteByTokens(@Param("tokens") Collection<String> tokens);

    @Modifying
    @Query("DELETE FROM PushToken p WHERE p.user.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
