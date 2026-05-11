package skatemap.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();

        // 1. Permitir que se envíen credenciales (cookies, headers de auth)
        config.setAllowCredentials(true);

        // 2. Dominios permitidos (Frontend)
        // IMPORTANTE: Añadimos la IP de tu hotspot y el puerto de Expo (8081)
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",      // Tu React Web original
                "http://localhost:8081",      // Expo Web (Navegador local)
                "https://provable-stench-congenial.ngrok-free.dev"     // Expo (App móvil vía ngrok)
        ));

        // 3. Headers permitidos
        config.setAllowedHeaders(Arrays.asList(
                "Origin", "Content-Type", "Accept", "Authorization",
                "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"
        ));

        // 4. Métodos permitidos (GET, POST, PUT, DELETE, OPTIONS vital para preflight)
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // Aplica esta configuración a todas las rutas de tu API
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }

}
