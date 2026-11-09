package skatemap.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import skatemap.service.SpotAiService;
import skatemap.service.SpotAiService.SearchResult;
import skatemap.service.SpotAiService.TagSuggestion;
import skatemap.service.WeatherService;
import skatemap.service.WeatherService.Weather;

import java.time.Duration;

/** AI-assisted spot features and the weather at a spot. */
@RestController
@RequestMapping("/api")
public class AiController {

    public record TagRequest(@NotBlank @Size(max = 500) String mediaUrl) {}

    public record SearchRequest(@NotBlank @Size(max = 200) String query,
                                @DecimalMin("-90") @DecimalMax("90") Double lat,
                                @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    private final SpotAiService spotAiService;
    private final WeatherService weatherService;

    public AiController(SpotAiService spotAiService, WeatherService weatherService) {
        this.spotAiService = spotAiService;
        this.weatherService = weatherService;
    }

    /** Type, level, name and description suggested from a photo the user just uploaded. */
    @PostMapping("/ai/suggest-tags")
    public ResponseEntity<TagSuggestion> suggestTags(@Valid @RequestBody TagRequest request, Authentication auth) {
        return ResponseEntity.ok(spotAiService.suggestTags(auth.getName(), request.mediaUrl()));
    }

    /**
     * Search in plain words: "smooth ledges for beginners near me". Public, rate-limited per IP. A
     * POST so the sentence (and the position) stay out of URLs and access logs.
     */
    @PostMapping("/search")
    public ResponseEntity<SearchResult> search(@Valid @RequestBody SearchRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(spotAiService.search(request.query(), request.lat(), request.lng()));
    }

    /** DRY / WET / RAIN at the spot, refreshed at most every 30 minutes. */
    @GetMapping("/spots/{spotId}/weather")
    public ResponseEntity<Weather> weather(@PathVariable Long spotId) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .body(weatherService.forSpot(spotId));
    }
}
