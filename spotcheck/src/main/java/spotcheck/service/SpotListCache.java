package spotcheck.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import spotcheck.dto.SpotDto;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

/**
 * Keeps the full spot list in memory: the map loads all spots on every open, so without this each
 * app start is one database query. Changes made through the API invalidate it immediately; the
 * short expiry picks up rows written directly to the database (e.g. the spot import tool).
 */
@Component
public class SpotListCache {

    private static final String KEY = "all";

    private final Cache<String, List<SpotDto>> cache = Caffeine.newBuilder()
            .maximumSize(1)
            .expireAfterWrite(Duration.ofSeconds(30))
            .build();

    public List<SpotDto> get(Supplier<List<SpotDto>> loader) {
        return cache.get(KEY, k -> List.copyOf(loader.get()));
    }

    /**
     * Inside a transaction the entry is dropped only after commit; dropping it earlier would let a
     * concurrent request reload and cache the old rows.
     */
    public void invalidate() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cache.invalidateAll();
                }
            });
        } else {
            cache.invalidateAll();
        }
    }
}
