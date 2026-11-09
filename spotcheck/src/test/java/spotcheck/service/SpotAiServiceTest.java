package spotcheck.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import spotcheck.dto.SpotDto;
import spotcheck.entity.enums.DifficultyLevel;
import spotcheck.entity.enums.SpotType;
import spotcheck.service.WeatherService.Condition;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The model's answers are untrusted: everything it says must be clamped to what we allow. */
class SpotAiServiceTest {

    private final ObjectMapper json = new ObjectMapper();

    private JsonNode parse(String text) throws Exception {
        return json.readTree(text);
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
