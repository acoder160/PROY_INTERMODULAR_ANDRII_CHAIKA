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

    // Leemos la URL del frontend desde application.properties / .env
    // (Si por algún motivo no encuentra la variable, usará localhost:5173 por defecto para no romper la app)
    @Value("${cors.allowed.origin}")
    private String frontendUrl;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();

        // 1. Permitir que se envíen credenciales (cookies, headers de auth)
        config.setAllowCredentials(true);

        // 2. Dominios permitidos (Frontend)
        config.setAllowedOrigins(Arrays.asList(
                frontendUrl,                  // Web
                "http://localhost:8081",      // Expo Web
                "https://provable-stench-congenial.ngrok-free.dev" // Expo (App móvil vía ngrok)
        ));

        // 3. Headers permitidos
        config.setAllowedHeaders(Arrays.asList(
                "Origin", "Content-Type", "Accept", "Authorization",
                "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"
        ));

        // 4. Métodos permitidos (GET, POST, PUT, DELETE, OPTIONS vital para preflight)
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}