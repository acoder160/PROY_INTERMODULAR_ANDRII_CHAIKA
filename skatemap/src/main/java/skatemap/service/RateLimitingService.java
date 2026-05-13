package skatemap.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitingService {

    // Mapas para almacenar los cubos por usuario y tipo de acción
    private final Map<String, Bucket> spotBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> commentBuckets = new ConcurrentHashMap<>();

    // Configuración para CREAR SPOTS: 2 cada 5 minutos
    public Bucket getSpotBucket(String username) {
        return spotBuckets.computeIfAbsent(username, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(2, Refill.intervally(2, Duration.ofMinutes(5))))
                .build());
    }

    // Configuración para COMENTARIOS: 10 cada 30 minutos
    public Bucket getCommentBucket(String username) {
        return commentBuckets.computeIfAbsent(username, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(10, Refill.intervally(10, Duration.ofMinutes(30))))
                .build());
    }
}