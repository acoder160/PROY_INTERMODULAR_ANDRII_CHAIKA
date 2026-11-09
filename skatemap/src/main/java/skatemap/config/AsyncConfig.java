package skatemap.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Background AI review of reports. Small and bounded on purpose: the AI free tiers allow a few
 * calls per minute, and if the queue is full the report simply waits for an admin.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    @Bean(name = "moderationExecutor")
    public Executor moderationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("moderation-");
        executor.setRejectedExecutionHandler((task, pool) ->
                log.warn("Report review queue is full: the report waits for an admin"));
        executor.initialize();
        return executor;
    }
}
