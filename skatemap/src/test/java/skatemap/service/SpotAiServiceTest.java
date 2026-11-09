package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import skatemap.dto.SpotDto;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;
import skatemap.service.SpotAiService.SearchFilters;
import skatemap.service.WeatherService.Condition;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The model's answers are untrusted: everything it says must be clamped to what we allow. */
class SpotAiServiceTest {

    private final ObjectMapper json = new ObjectMapper();

    private JsonNode parse(String text) throws Exception {
        return json.readTree(text);
    }

    @Test
    void searchFiltersKeepOnlyKnownValuesAndClampNumbers() throws Exception {
        SearchFilters f = SpotAiService.parseFilters(parse("""
                {"types":["RAIL","rail","BOWL"],"difficulty":["BEGINNER","god-mode"],
                 "minRating":9,"distanceKm":5000,
                 "keywords":["Smooth!","x","drop table spots;--","stairs","extra","more"]}"""));
        assertThat(f.types()).containsExactly(SpotType.RAIL);
        assertThat(f.difficulty()).containsExactly(DifficultyLevel.BEGINNER);
        assertThat(f.minRating()).isEqualTo(5);
        assertThat(f.distanceKm()).isEqualTo(SpotAiService.MAX_DISTANCE_KM);
        // Lowercased, punctuation stripped, short words dropped, at most three
        assertThat(f.keywords()).containsExactly("smooth", "droptablespots", "stairs");
    }

    @Test
    void withoutTheAiTheLongestWordsBecomeKeywords() {
        SearchFilters f = SpotAiService.keywordFilters("the macba ledges please");
        assertThat(f.keywords()).containsExactly("ledges", "please", "macba");
        assertThat(f.types()).isEmpty();
    }

    @Test
    void filtersApplyAndNearestComesFirst() {
        SpotDto near = spot(1L, "Smooth ledge", SpotType.LEDGE, DifficultyLevel.BEGINNER, 4.5, 41.3833, 2.1668);
        SpotDto far = spot(2L, "Smooth ledge far", SpotType.LEDGE, DifficultyLevel.BEGINNER, 5.0, 41.4100, 2.2270);
        SpotDto rail = spot(3L, "Handrail", SpotType.RAIL, DifficultyLevel.ADVANCED, 5.0, 41.3834, 2.1669);
        SpotDto badLedge = spot(4L, "Rough ledge", SpotType.LEDGE, DifficultyLevel.BEGINNER, 2.0, 41.3835, 2.1670);

        SearchFilters ledges = new SearchFilters(List.of(SpotType.LEDGE), List.of(), 4, 10, List.of("smooth"));
        assertThat(SpotAiService.apply(ledges, List.of(far, rail, badLedge, near), 41.3833, 2.1668))
                .extracting(SpotDto::getId).containsExactly(1L, 2L);

        // The distance itself is filtered in PostGIS before apply(); apply() only orders by it
        SearchFilters any = new SearchFilters(List.of(), List.of(), 0, 3, List.of());
        assertThat(SpotAiService.apply(any, List.of(far, near), 41.3833, 2.1668)).extracting(SpotDto::getId).containsExactly(1L, 2L);
    }

    @Test
    void tagSuggestionsIgnoreUnknownValuesAndMarkup() throws Exception {
        var tags = SpotAiService.parseTags(parse("""
                {"spotType":"bowl","difficulty":"intermediate","name":"  <b>Plaza</b>\\n ledges ",
                 "description":""}"""));
        assertThat(tags.available()).isTrue();
        assertThat(tags.spotType()).isNull();
        assertThat(tags.difficulty()).isEqualTo(DifficultyLevel.INTERMEDIATE);
        assertThat(tags.name()).isEqualTo("bPlaza/b ledges");
        assertThat(tags.description()).isNull();
    }

    @Test
    void weatherIsRainWetOrDry() throws Exception {
        assertThat(WeatherService.classify(parse("""
                {"current":{"precipitation":0.8,"weather_code":61,"temperature_2m":12.5},"hourly":{"precipitation":[0,0.8]}}"""))
                .condition()).isEqualTo(Condition.RAIN);
        assertThat(WeatherService.classify(parse("""
                {"current":{"precipitation":0,"weather_code":3},"hourly":{"precipitation":[1.2,0.4,0,0,0,0]}}"""))
                .condition()).isEqualTo(Condition.WET);
        var dry = WeatherService.classify(parse("""
                {"current":{"precipitation":0,"weather_code":1,"temperature_2m":21.0,"wind_speed_10m":9.0},"hourly":{"precipitation":[0,0,0.1]}}"""));
        assertThat(dry.condition()).isEqualTo(Condition.DRY);
        assertThat(dry.temperatureC()).isEqualTo(21.0);
    }

    private static SpotDto spot(Long id, String name, SpotType type, DifficultyLevel level, double rating, double lat, double lng) {
        SpotDto s = new SpotDto();
        s.setId(id);
        s.setName(name);
        s.setSpotType(type);
        s.setDifficultyLevel(level);
        s.setSurfaceRating(rating);
        s.setLatitude(lat);
        s.setLongitude(lng);
        return s;
    }
}
