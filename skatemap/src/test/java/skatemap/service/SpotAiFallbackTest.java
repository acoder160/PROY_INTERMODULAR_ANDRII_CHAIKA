package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import skatemap.dto.SpotDto;
import skatemap.entity.User;
import skatemap.entity.enums.SpotType;
import skatemap.service.OpenAiCompatClient.Provider;
import skatemap.service.SpotAiService.SearchResult;
import skatemap.service.SpotAiService.TagSuggestion;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** What tags and search do when the model fails or answers with something unusable. */
class SpotAiFallbackTest {

    private static final String PHOTO = "https://res.cloudinary.com/demo/image/upload/v1/skatemap_spots/u1/a.jpg";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Provider PROVIDER = new Provider("test", "http://localhost/x", "key", "model");

    private OpenAiCompatClient client;
    private ImageModerationService vision;
    private SpotService spotService;
    private SpotAiService service;

    @BeforeEach
    void setUp() {
        client = mock(OpenAiCompatClient.class);
        vision = mock(ImageModerationService.class);
        spotService = mock(SpotService.class);
        UserLookup userLookup = mock(UserLookup.class);
        User user = new User();
        user.setId(1L);
        when(userLookup.require("ana")).thenReturn(user);
        AiModerationService moderation = mock(AiModerationService.class);
        when(moderation.textProviders()).thenReturn(List.of(PROVIDER));
        service = new SpotAiService(vision, client, spotService, userLookup, moderation);

        SpotDto ledge = new SpotDto();
        ledge.setId(7L);
        ledge.setName("Guggenheim ledges");
        ledge.setSpotType(SpotType.LEDGE);
        ledge.setLatitude(43.26);
        ledge.setLongitude(-2.93);
        when(spotService.getAllSpots()).thenReturn(List.of(ledge));
    }

    private void modelAnswers(String body) throws Exception {
        JsonNode node = body == null ? null : JSON.readTree(body);
        when(client.chatJsonSchema(any(), anyString(), any(), anyInt(), anyString(), anyMap())).thenReturn(node);
    }

    // --- tags ---

    @Test
    void noVisionModelMeansNoSuggestionNotAnError() {
        when(vision.askAboutPhoto(anyString(), anyString(), eq(PHOTO), anyInt())).thenReturn(null);
        TagSuggestion tags = service.suggestTags("ana", PHOTO);
        assertThat(tags.available()).isFalse();
        assertThat(tags.spotType()).isNull();
        assertThat(tags.name()).isNull();
    }

    @Test
    void wronglyTypedTagFieldsAreIgnoredNotTrusted() throws Exception {
        TagSuggestion tags = SpotAiService.parseTags(JSON.readTree(
                "{\"spotType\":[\"RAIL\"],\"difficulty\":5,\"name\":{\"a\":1},\"description\":null}"));
        assertThat(tags.available()).isTrue();
        assertThat(tags.spotType()).isNull();
        assertThat(tags.difficulty()).isNull();
        assertThat(tags.name()).isNull();
        assertThat(tags.description()).isNull();
    }

    // --- search ---

    @Test
    void searchUsesTheModelsFilters() throws Exception {
        modelAnswers("{\"types\":[\"LEDGE\"],\"difficulty\":[],\"minRating\":0,\"distanceKm\":0,\"keywords\":[]}");
        SearchResult result = service.search("ledges", null, null);
        assertThat(result.aiUsed()).isTrue();
        assertThat(result.filters().types()).containsExactly(SpotType.LEDGE);
        assertThat(result.spots()).extracting(SpotDto::getId).containsExactly(7L);
    }

    @Test
    void searchFallsBackToKeywordsWhenNoModelAnswers() throws Exception {
        modelAnswers(null);
        SearchResult result = service.search("guggenheim please", null, null);
        assertThat(result.aiUsed()).isFalse();
        assertThat(result.filters().keywords()).contains("guggenheim");
        assertThat(result.spots()).extracting(SpotDto::getId).containsExactly(7L);
    }

    @Test
    void anAnswerWithoutUsableFiltersAlsoFallsBackToKeywords() throws Exception {
        // Empty object, and wrong types everywhere: nothing usable survives validation
        for (String garbage : List.of("{}", "{\"types\":\"LEDGE\",\"keywords\":\"guggenheim\",\"minRating\":\"high\"}",
                "{\"types\":[1,2,{}],\"difficulty\":[\"GOD\"]}")) {
            modelAnswers(garbage);
            SearchResult result = service.search("guggenheim", null, null);
            assertThat(result.filters().keywords()).as(garbage).contains("guggenheim");
        }
    }

    @Test
    void aNearMeSearchRunsInPostGisNotOverTheWholeList() throws Exception {
        modelAnswers("{\"types\":[],\"difficulty\":[],\"minRating\":0,\"distanceKm\":3,\"keywords\":[]}");
        when(spotService.findSpotsNearby(43.26, -2.93, 3000)).thenReturn(List.of());
        SearchResult result = service.search("close to me", 43.26, -2.93);
        assertThat(result.spots()).isEmpty();
        verify(spotService).findSpotsNearby(43.26, -2.93, 3000);
        verify(spotService, never()).getAllSpots();
    }

    @Test
    void aDistanceWithoutAPositionIsIgnored() throws Exception {
        modelAnswers("{\"types\":[\"LEDGE\"],\"difficulty\":[],\"minRating\":0,\"distanceKm\":3,\"keywords\":[]}");
        assertThat(service.search("close ledges", null, null).spots()).hasSize(1);
        verify(spotService, never()).findSpotsNearby(anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void emptyOrHugeSearchTextIsRejectedBeforeAnyModelCall() {
        org.junit.jupiter.api.Assertions.assertThrows(skatemap.exception.ApiException.class, () -> service.search("  ", null, null));
        org.junit.jupiter.api.Assertions.assertThrows(skatemap.exception.ApiException.class, () -> service.search("x".repeat(201), null, null));
        verifyNoInteractions(client);
    }
}
