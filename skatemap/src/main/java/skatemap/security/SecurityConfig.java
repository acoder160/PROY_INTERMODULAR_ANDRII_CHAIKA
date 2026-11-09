package skatemap.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.builders.WebSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // enables @PreAuthorize
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;

    @Value("${app.swagger.enabled:true}")
    private boolean swaggerEnabled;

    public SecurityConfig(UserDetailsServiceImpl userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())

                // No CSRF tokens: the API authenticates with a Bearer header. The only cookie (refresh
                // token) is read just by /api/auth/refresh and /logout, and CORS stops other origins
                // from reading the new access token
                .csrf(csrf -> csrf.disable())

                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Missing/expired token -> 401 (not the default 403), so clients know to refresh it
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))

                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/api/auth/**").permitAll();
                    // Spots and comments are readable without an account
                    auth.requestMatchers(HttpMethod.GET, "/api/spots/**").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/api/comments/**").permitAll();
                    // Profiles are public too, except the signed-in user's own account
                    auth.requestMatchers("/api/users/me", "/api/users/me/**").authenticated();
                    auth.requestMatchers(HttpMethod.GET, "/api/users/**").permitAll();
                    // Share links with link previews (outside /api)
                    auth.requestMatchers(HttpMethod.GET, "/s/**").permitAll();
                    // Live map updates: anonymous STOMP handshake, receive-only (see WebSocketConfig)
                    auth.requestMatchers("/ws", "/ws/**").permitAll();
                    auth.requestMatchers("/error").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/actuator/health").permitAll();
                    // Moderation queue and decisions (also guarded with @PreAuthorize)
                    auth.requestMatchers("/api/admin/**").hasRole("ADMIN");
                    if (swaggerEnabled) {
                        auth.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll();
                    }
                    // Everything else (create, rate, comment, upload) needs a JWT
                    auth.anyRequest().authenticated();
                });

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}