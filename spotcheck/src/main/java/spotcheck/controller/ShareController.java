package spotcheck.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import spotcheck.dto.SpotDto;
import spotcheck.exception.ApiException;
import spotcheck.service.SpotService;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Share links: {@code /s/{id}} serves a tiny HTML page with Open Graph tags (so WhatsApp, Telegram
 * or X show the spot's name and photo as a preview) and sends people on to the spot in the web map.
 * The web app is a static SPA, which crawlers can't render, so the preview has to come from here.
 */
@RestController
public class ShareController {

    static final String CONTENT_SECURITY_POLICY = "default-src 'none'; img-src https:; style-src 'unsafe-inline'";

    private final SpotService spotService;
    private final String webUrl;

    public ShareController(SpotService spotService, @Value("${cors.allowed.origin:}") String webUrl) {
        this.spotService = spotService;
        this.webUrl = webUrl == null ? "" : webUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/s/{spotId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> share(@PathVariable Long spotId) {
        String target = webUrl + "/map?spot=" + spotId;
        SpotDto spot;
        try {
            spot = spotService.getVisibleSpot(spotId);
        } catch (ApiException e) {
            // Removed or hidden spot: still send people to the map
            return ResponseEntity.status(302).header("Location", webUrl + "/map").build();
        }
        String title = escape(spot.getName()) + " · SpotCheck";
        String description = escape(spot.getDescription() == null || spot.getDescription().isBlank()
                ? "Skate spot on SpotCheck" : abbreviate(spot.getDescription()));
        String image = spot.getMediaUrl() == null ? "" : escape(
                spot.getMediaUrl().replaceFirst("/image/upload/", "/image/upload/c_fill,w_1200,h_630,q_auto/"));
        String url = escape(target);

        String html = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<title>" + title + "</title>"
                + "<meta property=\"og:type\" content=\"website\">"
                + "<meta property=\"og:site_name\" content=\"SpotCheck\">"
                + "<meta property=\"og:title\" content=\"" + title + "\">"
                + "<meta property=\"og:description\" content=\"" + description + "\">"
                + "<meta property=\"og:url\" content=\"" + url + "\">"
                + (image.isEmpty() ? "" : "<meta property=\"og:image\" content=\"" + image + "\">"
                + "<meta name=\"twitter:card\" content=\"summary_large_image\">")
                + "<meta http-equiv=\"refresh\" content=\"0;url=" + url + "\">"
                + "</head><body style=\"font-family:sans-serif;background:#1c1c1c;color:#fff\">"
                + "<p><a style=\"color:#ff4fa3\" href=\"" + url + "\">" + title + "</a></p>"
                + "</body></html>";
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
                .body(html);
    }

    static String abbreviate(String text) {
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return oneLine.length() <= 160 ? oneLine : oneLine.substring(0, 157) + "...";
    }

    /** User text goes into HTML attributes and text: escape everything that could break out. */
    static String escape(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
