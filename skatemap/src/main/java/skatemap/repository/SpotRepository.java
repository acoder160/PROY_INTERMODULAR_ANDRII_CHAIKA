package skatemap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import skatemap.entity.Spot;

public interface SpotRepository extends JpaRepository<Spot, Long> {
}
