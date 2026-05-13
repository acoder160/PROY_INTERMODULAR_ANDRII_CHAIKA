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

    // Convierte la cadena separada por comas en una Lista de Strings
    @Value("#{'${cors.allowed.origins}'.split(',')}")
    private List<String> allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();

        // 1. Permitir que se envíen credenciales (cookies, headers de auth)
        config.setAllowCredentials(true);

        // 2. Dominios permitidos (Inyectados dinámicamente)
        config.setAllowedOrigins(allowedOrigins);

        // 3. Headers permitidos
        config.setAllowedHeaders(Arrays.asList(
                "Origin", "Content-Type", "Accept", "Authorization",
                "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"
        ));

        // 4. Métodos permitidos
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // Aplica esta configuración a todas las rutas de tu API
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}