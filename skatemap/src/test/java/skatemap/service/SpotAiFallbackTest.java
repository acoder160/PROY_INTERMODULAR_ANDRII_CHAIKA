package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import skatemap.entity.User;
import skatemap.service.SpotAiService.TagSuggestion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** What the tag suggestion does when the model fails or answers with something unusable. */
class SpotAiFallbackTest {

    private static final String PHOTO = "https://res.cloudinary.com/demo/image/upload/v1/skatemap_spots/u1/a.jpg";
    private static final ObjectMapper JSON = new ObjectMapper();

    private ImageModerationService vision;
    private SpotAiService service;

    @BeforeEach
    void setUp() {
        vision = mock(ImageModerationService.class);
        UserLookup userLookup = mock(UserLookup.class);
        User user = new User();
        user.setId(1L);
        when(userLookup.require("ana")).thenReturn(user);
        service = new SpotAiService(vision, userLookup);
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
}
