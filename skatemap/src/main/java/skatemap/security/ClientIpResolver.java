package skatemap.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Resolves the real client IP for per-IP rate limits.
 *
 * Behind a reverse proxy every request comes from the proxy's address, so the proxy header must be
 * configured via {@code app.client-ip-header}:
 * <ul>
 *   <li>{@code X-Forwarded-For} (Render, Caddy, nginx): the right-most entry is the one appended by
 *       our own proxy; anything to its left is client-controlled and can be spoofed.</li>
 *   <li>{@code CF-Connecting-IP} (Cloudflare): a single value set by Cloudflare.</li>
 * </ul>
 * Leave it empty when the app is reached directly.
 */
@Component
public class ClientIpResolver {

    private final String header;

    public ClientIpResolver(@Value("${app.client-ip-header:}") String header) {
        this.header = header == null ? "" : header.trim();
    }

    public String resolve(HttpServletRequest request) {
        if (!header.isEmpty()) {
            String value = request.getHeader(header);
            if (value != null && !value.isBlank()) {
                String[] parts = value.split(",");
                String last = parts[parts.length - 1].trim();
                if (!last.isEmpty()) return last;
            }
        }
        return request.getRemoteAddr();
    }
}
