package skatemap.security;

import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import skatemap.service.RateLimitingService;
import skatemap.service.RateLimitingService.Limit;

import java.util.concurrent.TimeUnit;

/**
 * Applies rate limits to write endpoints (per user) and to auth endpoints (per client IP).
 * Responds 429 with a Retry-After header. The JSON body carries both "error" and "message",
 * which is what the mobile and web clients read.
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitingService rateLimitingService;
    private final ClientIpResolver clientIpResolver;
    private final boolean enabled;

    public RateLimitInterceptor(RateLimitingService rateLimitingService,
                                ClientIpResolver clientIpResolver,
                                @Value("${app.rate-limit.enabled:true}") boolean enabled) {
        this.rateLimitingService = rateLimitingService;
        this.clientIpResolver = clientIpResolver;
        this.enabled = enabled;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!enabled) return true;

        Limit limit = limitFor(request.getMethod(), request.getRequestURI());
        if (limit == null) return true;

        String key;
        if (isPerIp(limit)) {
            key = clientIpResolver.resolve(request);
        } else {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            // Unauthenticated writes are rejected by Spring Security before reaching here
            if (auth == null || !auth.isAuthenticated()) return true;
            key = auth.getName();
            if (isAdmin(auth)) limit = adminVariant(limit);
        }

        ConsumptionProbe probe = rateLimitingService.bucket(limit, key).tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) return true;

        long retryAfter = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()));
        String message = "Too many requests. Try again in " + retryAfter + " s.";
        response.setStatus(429);
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + message + "\",\"message\":\"" + message + "\"}");
        return false;
    }

    static Limit limitFor(String method, String path) {
        if ("POST".equalsIgnoreCase(method)) {
            switch (path) {
                case "/api/auth/login": return Limit.LOGIN;
                case "/api/auth/register": return Limit.REGISTER;
                case "/api/auth/refresh": return Limit.REFRESH;
                case "/api/auth/google":
                case "/api/auth/google/exchange": return Limit.GOOGLE;
                case "/api/spots": return Limit.SPOT_CREATE;
                default:
                    if (path.startsWith("/api/comments/")) return Limit.COMMENT;
                    if (path.startsWith("/api/spots/") && path.endsWith("/reports")) return Limit.REPORT;
                    return null;
            }
        }
        if ("GET".equalsIgnoreCase(method)) {
            if (path.equals("/api/auth/google/start")) return Limit.GOOGLE;
            if (path.equals("/api/cloudinary/signature")) return Limit.UPLOAD_SIGNATURE;
        }
        return null;
    }

    private static boolean isPerIp(Limit limit) {
        return limit == Limit.LOGIN || limit == Limit.REGISTER || limit == Limit.REFRESH || limit == Limit.GOOGLE;
    }

    private static Limit adminVariant(Limit limit) {
        if (limit == Limit.SPOT_CREATE) return Limit.SPOT_CREATE_ADMIN;
        if (limit == Limit.COMMENT) return Limit.COMMENT_ADMIN;
        return limit;
    }

    private static boolean isAdmin(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
