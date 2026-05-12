package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class AiModerationService {

    @Value("${ai.groq.api.key}")
    private String groqApiKey;

    @Value("${ai.openai.api.key}")
    private String openaiApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";

    // 🟢 FASE 1: FILTRO LOCAL "TONTO" (Rápido y gratis)
    private static final Pattern PHONE_REGEX = Pattern.compile(".*\\d{6,15}.*");

    // Solo dejamos spam comercial descarado, insultos extremos sin contexto y links.
    private static final List<String> FORBIDDEN_WORDS = Arrays.asList(
            "vendo", "venta", "compro", "compramos", "oferta",
            "puta", "puto", "sexo", "porno", "http", "www"
    );

    public boolean isContentAllowed(String textToAnalyze) {
        if (textToAnalyze == null || textToAnalyze.trim().isEmpty()) {
            return false;
        }

        String lowerText = textToAnalyze.toLowerCase();

        // 🛡️ 1. COMPROBACIÓN LOCAL
        if (PHONE_REGEX.matcher(lowerText).matches()) {
            System.out.println("Bloqueo Local: Número de teléfono detectado.");
            return false;
        }
        for (String word : FORBIDDEN_WORDS) {
            if (lowerText.matches(".*\\b" + word + "\\b.*")) {
                System.out.println("Bloqueo Local: Palabra prohibida detectada -> " + word);
                return false;
            }
        }

        // 🤖 2. COMPROBACIÓN POR IA (Con el prompt completo y detallado)
        String prompt = "Eres un moderador de seguridad estricto pero comprensivo para una app comunitaria de mapas de skate. " +
                "Tu trabajo es analizar este texto y decidir si es seguro publicarlo.\n\n" +
                "REGLAS ESTRICTAS PARA BLOQUEAR (debes bloquear si cumple alguna):\n" +
                "1. Ventas o negocios: Intención explícita de vender, comprar o publicitar algo (tablas, drogas, servicios, lo que sea).\n" +
                "2. Tráfico de Drogas: Intento de VENTA, distribución o promoción de sustancias ilegales.\n" +
                "3. Contactos personales: Compartir números de teléfono, redes sociales pidiendo seguidores o correos electrónicos.\n" +
                "4. Basura/Spam: Caracteres aleatorios sin sentido aplastando el teclado (ej. 'asdfgh', 'jsjsjoies').\n" +
                "5. Toxicidad extrema: Acoso directo a una persona o contenido sexual explícito.\n\n" +
                "LO QUE SÍ ESTÁ PERMITIDO Y ES ÚTIL (NO BLOQUEAR):\n" +
                "- Avisos sobre la POLICÍA, multas, guardias o vecinos (ej: 'Nos ha pillado la policía por fumar', 'Cuidado con los secretas', 'Los vecinos tiran agua'). ¡Esto es información vital!\n" +
                "- Mencionar que la gente fuma o bebe en el lugar de forma descriptiva (ej: 'Es un sitio donde la gente va a fumar hierba', 'Siempre hay latas de cerveza'). Esto describe el ambiente, NO es venta.\n" +
                "- Opiniones personales sobre el lugar (ej: 'Me encanta este sitio', 'Es una mierda porque el suelo está roto', 'Sitio muy tranquilo').\n" +
                "- Comentarios sobre el skate, trucos, rampas, escaleras, bordillos o material del parque.\n" +
                "- Mencionar elementos del entorno (ej: 'Hay una fuente cerca', 'Vigilen con la policía por la noche', 'Se llena de niños por la tarde').\n" +
                "- Lenguaje coloquial, expresiones comunes o quejas normales de los usuarios, siempre que no rompan las reglas de bloqueo mencionadas arriba.\n\n" +
                "Responde ÚNICAMENTE con un JSON estricto en este formato exacto: {\"allowed\": true} o {\"allowed\": false}. " +
                "No añadas Markdown. Texto a analizar: \"" + textToAnalyze + "\"";

        // Capa 1: Llama 3.1 8B (Groq)
        Boolean result = callAiApi(GROQ_URL, groqApiKey, "llama-3.1-8b-instant", prompt);
        if (result != null) return result;

        // Capa 2: Llama 3 8B (Groq Fallback)
        result = callAiApi(GROQ_URL, groqApiKey, "llama3-8b-8192", prompt);
        if (result != null) return result;

        // Capa 3: GPT-4o-mini (OpenAI - El salvavidas)
        result = callAiApi(OPENAI_URL, openaiApiKey, "gpt-4o-mini", prompt);
        if (result != null) return result;

        // Capa 4: Gemma 2 9B (Groq)
        result = callAiApi(GROQ_URL, groqApiKey, "gemma2-9b-it", prompt);
        if (result != null) return result;

        // Capa 5: Mistral 7B (Groq - Emergencia)
        result = callAiApi(GROQ_URL, groqApiKey, "mistral-7b-32768", prompt);
        if (result != null) return result;

        // Si todo falla (No hay internet o claves incorrectas), bloqueamos por seguridad
        throw new RuntimeException("Servicios de moderación de IA caídos en este momento.");
    }

    private Boolean callAiApi(String url, String apiKey, String model, String prompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", prompt);

            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("messages", List.of(message));
            body.put("temperature", 0.0); // Queremos respuestas deterministas (sin alucinaciones)

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String content = root.path("choices").get(0).path("message").path("content").asText();

            // Limpiamos la respuesta por si la IA añade markdown (```json ... ```)
            content = content.replace("```json", "").replace("```", "").trim();

            JsonNode resultNode = objectMapper.readTree(content);
            return resultNode.path("allowed").asBoolean();

        } catch (Exception e) {
            System.err.println("Fallo en la Capa IA [" + model + "]: Saltando al siguiente...");
            return null; // Devolvemos null para que el código intente la siguiente capa
        }
    }
}