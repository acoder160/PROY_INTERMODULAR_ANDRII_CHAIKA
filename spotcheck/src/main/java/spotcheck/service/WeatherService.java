package spotcheck.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import spotcheck.dto.SpotDto;
import spotcheck.exception.ApiException;

import java.time.Duration;
import java.util.Locale;

/**
 * "Is it skateable right now?" Wet ground is the first thing a skater asks about, so the spot shows
 * DRY / WET / RAIN from Open-Meteo (free, no key). Answers are cached for 30 minutes per ~1 km cell,
 * so a busy spot costs one call per half hour, not one per visitor.
 */
@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    public enum Condition { DRY, WET, RAIN }

    public record Weather(Condition condition, Double temperatureC, Double windKmh, Integer weatherCode) {}

    /** Rain in the last hours above this (mm) leaves the ground wet. */
    static final double WET_AFTER_MM = 0.5;

    private final SpotService spotService;
    private final ObjectMapper mapper;
    private final String baseUrl;
    private final RestTemplate http;
    private final Cache<String, Weather> cache = Caffeine.newBuilder()
            .maximumSize(5_000)
            .expireAfterWrite(Duration.ofMinutes(30))
            .build();
    /** Open-Meteo failed for this cell: don't make every visitor wait for its timeout again. */
    private final Cache<String, Boolean> failures = Caffeine.newBuilder()
            .maximumSize(5_000)
            .expireAfterWrite(Duration.ofMinutes(2))
            .build();

    public WeatherService(SpotService spotService, ObjectMapper mapper,
                          @Value("${app.weather.url:https://api.open-meteo.com/v1/forecast}") String baseUrl) {
        this.spotService = spotService;
        this.mapper = mapper;
        this.baseUrl = baseUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(5_000);
        this.http = new RestTemplate(factory);
    }

    public Weather forSpot(Long spotId) {
        SpotDto spot = spotService.getVisibleSpot(spotId);
        // ~1 km cells: nearby spots share one answer
        String cell = String.format(Locale.ROOT, "%.2f,%.2f", spot.getLatitude(), spot.getLongitude());
        // get(key, loader) is atomic: simultaneous visitors share one Open-Meteo call. A loader that
        // throws caches nothing, so only successes are kept for 30 minutes
        return cache.get(cell, key -> {
            if (failures.getIfPresent(key) != null) throw ApiException.unavailable("Weather is not available right now");
            try {
                return fetch(spot.getLatitude(), spot.getLongitude());
            } catch (ApiException unavailable) {
                failures.put(key, Boolean.TRUE);
                throw unavailable;
            }
        });
    }

    private Weather fetch(double lat, double lng) {
        String url = String.format(Locale.ROOT,
                "%s?latitude=%.4f&longitude=%.4f&current=temperature_2m,precipitation,weather_code,wind_speed_10m"
                        + "&hourly=precipitation&past_hours=6&forecast_hours=1&timezone=UTC",
                baseUrl, lat, lng);
        try {
            return classify(mapper.readTree(http.getForObject(url, String.class)));
        } catch (Exception e) {
            log.warn("Weather unavailable: {}", e.getClass().getSimpleName());
            throw ApiException.unavailable("Weather is not available right now");
        }
    }

    /** Raining now → RAIN; enough rain in the last 6 hours → WET; otherwise DRY. */
    static Weather classify(JsonNode root) {
        JsonNode current = root.path("current");
        double nowMm = current.path("precipitation").asDouble(0);
        int code = current.path("weather_code").asInt(0);
        // WMO codes: drizzle 51-57, rain 61-67, showers 80-82, thunderstorm 95-99
        boolean rainingCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
        double recentMm = 0;
        for (JsonNode v : root.path("hourly").path("precipitation")) recentMm += v.asDouble(0);

        Condition condition = nowMm > 0.1 || rainingCode ? Condition.RAIN
                : recentMm >= WET_AFTER_MM ? Condition.WET
                : Condition.DRY;
        return new Weather(condition,
                current.has("temperature_2m") ? current.path("temperature_2m").asDouble() : null,
                current.has("wind_speed_10m") ? current.path("wind_speed_10m").asDouble() : null,
                current.has("weather_code") ? code : null);
    }
}
