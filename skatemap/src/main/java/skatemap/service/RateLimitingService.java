package skatemap.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Token buckets per (limit, key). Buckets live in a bounded cache and expire after an hour of
 * inactivity, so memory stays flat no matter how many users or IPs hit the API.
 */
@Service
public class RateLimitingService {

    public enum Limit {
        // Per user
        SPOT_CREATE(2, Duration.ofMinutes(5)),
        SPOT_CREATE_ADMIN(30, Duration.ofMinutes(5)),
        COMMENT(10, Duration.ofMinutes(30)),
        COMMENT_ADMIN(100, Duration.ofMinutes(30)),
        UPLOAD_SIGNATURE(20, Duration.ofHours(1)),
        // Per client IP
        LOGIN(10, Duration.ofMinutes(1)),
        REGISTER(5, Duration.ofHours(1)),
        REFRESH(30, Duration.ofMinutes(1)),
        GOOGLE(20, Duration.ofMinutes(1));

        final long capacity;
        final Duration period;

        Limit(long capacity, Duration period) {
            this.capacity = capacity;
            this.period = period;
        }
    }

    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    public Bucket bucket(Limit limit, String key) {
        return buckets.get(limit.name() + ':' + key, k -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limit.capacity)
                        .refillIntervally(limit.capacity, limit.period)
                        .build())
                .build());
    }
}
