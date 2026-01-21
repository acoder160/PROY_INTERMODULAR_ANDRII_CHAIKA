package skatemap.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI myOpenAPI() {
        // 1. Definir el esquema de seguridad (JWT)
        String securitySchemeName = "BearerAuth";

        SecurityScheme securityScheme = new SecurityScheme()
                .name(securitySchemeName)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");

        // 2. Crear la configuración con los metadatos de tu App
        return new OpenAPI()
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components().addSecuritySchemes(securitySchemeName, securityScheme))
                .info(new Info()
                        .title("SkateMap API")
                        .version("1.0")
                        .description("API para la gestión de spots de skate, fotos y comunidad.")
                        .contact(new Contact()
                                .name("Skatemap Team")
                                .email("soporte@skatemap.com"))
                        .license(new License().name("Apache 2.0").url("http://springdoc.org")));
    }
}