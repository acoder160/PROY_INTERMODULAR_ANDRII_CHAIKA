package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import skatemap.service.OpenAiCompatClient.Provider;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/** json_schema is asked first; a provider that answers 400 to it is asked again in plain JSON mode. */
class OpenAiCompatClientSchemaTest {

    private static final Map<String, Object> SCHEMA = Map.of("type", "object",
            "properties", Map.of("ok", Map.of("type", "boolean")), "required", List.of("ok"), "additionalProperties", false);

    private HttpServer server;
    private final List<String> requests = new CopyOnWriteArrayList<>();
    private volatile boolean rejectSchemas;
    private Provider provider;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requests.add(body);
            boolean schema = body.contains("json_schema");
            int status = schema && rejectSchemas ? 400 : 200;
            byte[] answer = (status == 400 ? "{\"error\":\"unsupported response_format\"}"
                    : "{\"choices\":[{\"message\":{\"content\":\"{\\\"ok\\\":true}\"}}]}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
        provider = new Provider("local", "http://127.0.0.1:" + server.getAddress().getPort() + "/chat", "key", "some-model");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void theSchemaIsSentInStrictMode() {
        JsonNode answer = new OpenAiCompatClient().chatJsonSchema(provider, "sys", "user", 50, "probe", SCHEMA);
        assertThat(answer.path("ok").asBoolean()).isTrue();
        assertThat(requests).hasSize(1);
        assertThat(requests.get(0)).contains("\"json_schema\"").contains("\"strict\":true").contains("\"name\":\"probe\"");
    }

    @Test
    void aProviderThatRejectsSchemasIsAskedAgainInJsonMode() {
        rejectSchemas = true;
        JsonNode answer = new OpenAiCompatClient().chatJsonSchema(provider, "sys", "user", 50, "probe", SCHEMA);
        assertThat(answer).isNotNull();
        assertThat(answer.path("ok").asBoolean()).isTrue();
        assertThat(requests).hasSize(2);
        assertThat(requests.get(1)).contains("\"json_object\"").doesNotContain("json_schema");
    }
}
