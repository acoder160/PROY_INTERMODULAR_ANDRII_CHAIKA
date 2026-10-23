package skatemap.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    // Convierte la cadena en una Lista de Strings
    @Value("#{'${cors.allowed.origins}'.split(',')}")
    private List<String> allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();

        // Permitir que se envíen credenciales
        config.setAllowCredentials(true);

        // Dominios permitidos
        List<String> normalizedOrigins = allowedOrigins.stream()
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
        if (normalizedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "CORS_ORIGINS must list explicit origins when credentials are enabled");
        }
        config.setAllowedOrigins(normalizedOrigins);

        // Headers permitidos
        config.setAllowedHeaders(Arrays.asList(
                "Origin", "Content-Type", "Accept", "Authorization",
                "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials",
                "X-Client-Type", "X-Refresh-Token", "ngrok-skip-browser-warning"
        ));
        config.setExposedHeaders(List.of("Set-Cookie"));

        //  Métodos permitidos
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}