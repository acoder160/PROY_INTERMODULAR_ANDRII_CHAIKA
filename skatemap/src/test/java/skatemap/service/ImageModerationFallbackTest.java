package skatemap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import skatemap.exception.ApiException;
import skatemap.service.ImageModerationService.Outcome;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** What the photo check does when the providers fail (free tiers run out often). */
class ImageModerationFallbackTest {

    private static final String URL = "https://res.cloudinary.com/demo/image/upload/v1/skatemap_spots/u1/a.jpg";
    private static final ObjectMapper JSON = new ObjectMapper();

    private OpenAiCompatClient client;
    private ImageModerationService service;

    @BeforeEach
    void setUp() {
        client = mock(OpenAiCompatClient.class);
        service = new ImageModerationService(client, "groq-key", "openai-key", "qwen/qwen3.8-27b", "gpt-4o-mini");
    }

    @Test
    void cleanModerationAndNoVisionModelAllowsThePhotoForAdminReview() throws Exception {
        when(client.moderate(any(), anyList())).thenReturn(JSON.readTree("{\"categories\":{},\"category_scores\":{}}"));
        when(client.chatJson(any(), any(), any(), anyInt(), anyBoolean())).thenReturn(null);
        assertEquals(Outcome.ALLOW, service.checkUpload(URL, "Plaza", "Ledges").outcome());
    }

    @Test
    void flaggedPhotoIsRejectedWithoutAskingTheVisionModel() throws Exception {
        when(client.moderate(any(), anyList())).thenReturn(JSON.readTree("{\"categories\":{\"sexual\":true}}"));
        assertEquals(Outcome.REJECT, service.checkUpload(URL, "Plaza", "Ledges").outcome());
        verify(client, never()).chatJson(any(), any(), any(), anyInt(), anyBoolean());
    }

    @Test
    void noProviderAtAllRefusesTheUpload() {
        when(client.moderate(any(), anyList())).thenReturn(null);
        when(client.chatJson(any(), any(), any(), anyInt(), anyBoolean())).thenReturn(null);
        ApiException ex = assertThrows(ApiException.class, () -> service.checkUpload(URL, "Plaza", "Ledges"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
    }

    @Test
    void visionAnswerDecidesWhenAvailable() throws Exception {
        when(client.moderate(any(), anyList())).thenReturn(null);
        when(client.chatJson(any(), any(), any(), anyInt(), anyBoolean()))
                .thenReturn(JSON.readTree("{\"is_place_photo\":false,\"quality\":\"clear\"}"));
        assertEquals(Outcome.NOT_PLACE, service.checkUpload(URL, "Plaza", "Ledges").outcome());
    }
}
