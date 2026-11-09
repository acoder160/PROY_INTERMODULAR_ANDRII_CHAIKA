package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Minimal client for OpenAI-compatible chat APIs (Groq and OpenAI) and OpenAI's free moderation
 * endpoint. Every call returns null on any failure (timeout, 429, bad JSON...) so callers can try
 * the next provider; nothing here throws.
 */
@Component
public class OpenAiCompatClient {

    public static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    public static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    static final String OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

    /** One model on one provider. */
    public record Provider(String label, String url, String apiKey, String model) {
        boolean isOpenAi() {
            return url.startsWith("https://api.openai.com");
        }
    }

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatClient.class);
    private static final Pattern THINK_BLOCK = Pattern.compile("(?s)<think>.*?</think>");

    private final ObjectMapper mapper = new ObjectMapper();
    // Text answers come back in about a second; images take longer (the provider downloads them)
    private final RestTemplate textClient = restTemplate(3_000, 5_000);
    private final RestTemplate visionClient = restTemplate(3_000, 15_000);

    private static RestTemplate restTemplate(int connectMs, int readMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectMs);
        factory.setReadTimeout(readMs);
        return new RestTemplate(factory);
    }

    /**
     * Asks for a JSON object and returns it parsed, or null if the provider failed or did not answer
     * with JSON. {@code userContent} is a String or a list of content parts (text + image_url).
     */
    public JsonNode chatJson(Provider provider, String systemPrompt, Object userContent, int maxTokens, boolean vision) {
        // JSON mode is reliable for text models; vision previews on Groq may not support it, so for
        // images the JSON is extracted from the answer instead
        return chat(provider, systemPrompt, userContent, maxTokens, vision, vision ? null : JSON_OBJECT).json();
    }

    /**
     * Like {@link #chatJson} for text, but asks the provider to follow a JSON schema (strict mode), so
     * the answer has exactly the fields we parse. A provider or model that rejects schemas (HTTP 400)
     * is asked again in plain JSON mode: the caller validates the values either way.
     */
    public JsonNode chatJsonSchema(Provider provider, String systemPrompt, Object userContent, int maxTokens,
                                   String schemaName, Map<String, Object> schema) {
        Map<String, Object> format = Map.of("type", "json_schema",
                "json_schema", Map.of("name", schemaName, "strict", true, "schema", schema));
        Chat first = chat(provider, systemPrompt, userContent, maxTokens, false, format);
        if (first.formatRejected()) {
            log.info("AI provider [{}] rejected the JSON schema, asking in JSON mode", provider.label());
            return chat(provider, systemPrompt, userContent, maxTokens, false, JSON_OBJECT).json();
        }
        return first.json();
    }

    private static final Map<String, Object> JSON_OBJECT = Map.of("type", "json_object");

    /** {@code formatRejected}: the provider answered 400 to the response_format we sent. */
    private record Chat(JsonNode json, boolean formatRejected) {}

    private Chat chat(Provider provider, String systemPrompt, Object userContent, int maxTokens, boolean vision,
                      Map<String, Object> responseFormat) {
        if (provider.apiKey() == null || provider.apiKey().isBlank()) {
            log.warn("AI provider [{}] skipped: API key missing", provider.label());
            return new Chat(null, false);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", provider.model());
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userContent)));
            body.put("temperature", 0.0);
            body.put("max_completion_tokens", maxTokens);
            if (responseFormat != null) body.put("response_format", responseFormat);
            String effort = reasoningEffort(provider.model());
            if (effort != null) body.put("reasoning_effort", effort);

            ResponseEntity<String> response = postWithOneRetry(vision ? visionClient : textClient,
                    provider.url(), new HttpEntity<>(body, headers(provider.apiKey())));
            JsonNode root = mapper.readTree(response.getBody());
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            JsonNode json = extractJson(content);
            if (json == null) log.warn("AI provider [{}] answered without a JSON object", provider.label());
            return new Chat(json, false);
        } catch (HttpStatusCodeException e) {
            log.warn("AI provider [{}] failed: HTTP {}", provider.label(), e.getStatusCode().value());
            return new Chat(null, e.getStatusCode().value() == 400 && responseFormat != null);
        } catch (Exception e) {
            log.warn("AI provider [{}] failed: {}", provider.label(), e.getClass().getSimpleName());
            return new Chat(null, false);
        }
    }

    /**
     * OpenAI moderation (free). {@code input} is a list of parts: {"type":"text",...} and/or
     * {"type":"image_url",...}. Returns results[0] (with "categories" and "category_scores") or null.
     */
    public JsonNode moderate(String apiKey, List<Map<String, Object>> input) {
        if (apiKey == null || apiKey.isBlank()) return null;
        try {
            Map<String, Object> body = Map.of("model", "omni-moderation-latest", "input", input);
            ResponseEntity<String> response = visionClient.postForEntity(
                    OPENAI_MODERATION_URL, new HttpEntity<>(body, headers(apiKey)), String.class);
            JsonNode result = mapper.readTree(response.getBody()).path("results").path(0);
            return result.isMissingNode() ? null : result;
        } catch (HttpStatusCodeException e) {
            log.warn("OpenAI moderation failed: HTTP {}", e.getStatusCode().value());
            return null;
        } catch (Exception e) {
            log.warn("OpenAI moderation failed: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * Free tiers answer 429 with a short Retry-After when a burst hits the per-minute limit: waiting
     * that long once is cheaper than failing the request. Longer waits go to the next provider.
     */
    private static ResponseEntity<String> postWithOneRetry(RestTemplate client, String url, HttpEntity<?> request) {
        try {
            return client.postForEntity(url, request, String.class);
        } catch (HttpStatusCodeException e) {
            long waitMs = retryAfterMs(e);
            if (e.getStatusCode().value() != 429 || waitMs < 0 || waitMs > MAX_RETRY_WAIT_MS) throw e;
            try {
                Thread.sleep(waitMs);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return client.postForEntity(url, request, String.class);
        }
    }

    private static final long MAX_RETRY_WAIT_MS = 5_000;

    /** Retry-After in milliseconds (Groq sends seconds, sometimes fractional), or -1 if absent. */
    static long retryAfterMs(HttpStatusCodeException e) {
        String value = e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst("retry-after");
        if (value == null) return -1;
        try {
            return Math.max(0, Math.round(Double.parseDouble(value.trim()) * 1000));
        } catch (NumberFormatException notANumber) {
            return -1;
        }
    }

    private static HttpHeaders headers(String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        return headers;
    }

    /** gpt-oss reasons before answering: "low" keeps it short (the token limit is what runs out first). */
    static String reasoningEffort(String model) {
        if (model.startsWith("openai/gpt-oss")) return "low";
        if (model.startsWith("qwen/")) return "none";
        return null;
    }

    /** Takes the first JSON object out of a model answer (drops <think> blocks and ``` fences). */
    JsonNode extractJson(String content) {
        if (content == null) return null;
        String text = THINK_BLOCK.matcher(content).replaceAll("").replace("```json", "").replace("```", "").trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try {
            JsonNode node = mapper.readTree(text.substring(start, end + 1));
            return node.isObject() ? node : null;
        } catch (Exception e) {
            return null;
        }
    }
}
