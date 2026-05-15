package skatemap.security;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import skatemap.service.RateLimitingService;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitingService rateLimitingService;

    public RateLimitInterceptor(RateLimitingService rateLimitingService) {
        this.rateLimitingService = rateLimitingService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String method = request.getMethod();
        String path = request.getRequestURI();

        // Solo aplicamos límites a peticiones de creación (POST)
        if (!"POST".equalsIgnoreCase(method)) return true;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return true;

        String username = auth.getName();

        // EXCEPCION: Si es ADMIN, vía libre
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) return true;

        Bucket bucket = null;
        String message = "";

        // Lógica según el endpoint
        if (path.startsWith("/api/spots") && !path.contains("/comments")) {
            bucket = rateLimitingService.getSpotBucket(username);
            message = "Límite de creación de spots alcanzado (2 cada 5 min).";
        } else if (path.contains("/comments")) {
            bucket = rateLimitingService.getCommentBucket(username);
            message = "Límite de comentarios alcanzado (10 cada 30 min).";
        }

        if (bucket != null) {
            ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
            if (!probe.isConsumed()) {
                // BLOQUEO: Demasiadas peticiones
                response.setStatus(429); // Too Many Requests
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"" + message + "\"}");
                return false;
            }
        }

        return true;
    }
}