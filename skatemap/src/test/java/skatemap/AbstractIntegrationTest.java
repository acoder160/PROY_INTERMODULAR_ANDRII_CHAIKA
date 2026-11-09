package skatemap;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for tests that run the whole application against a real PostgreSQL + PostGIS in Docker,
 * with the Flyway migrations applied. One container is shared by every subclass.
 * Without Docker these tests are skipped instead of failing, so `mvnw test` still works offline;
 * CI always has Docker.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("it")
@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractIntegrationTest {

    // Started once for the whole test run and left to Testcontainers (Ryuk) to remove at exit. A @Container
    // field would stop it after each class, while Spring reuses the cached context of the next class that
    // has the same configuration, and that context would point at a database that is gone.
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));

    static {
        POSTGIS.start();
    }
}
