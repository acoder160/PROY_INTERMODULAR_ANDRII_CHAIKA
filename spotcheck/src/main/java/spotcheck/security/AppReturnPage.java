package spotcheck.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * The page the browser lands on after Google sign-in, which hands control back to the mobile app.
 *
 * A bare 302 to a custom scheme (spotcheckmobile://, exp://) is unreliable on Android: Chrome may
 * block an external-app jump that wasn't started by a tap and just keep spinning. This page tries
 * the jump right away and also shows a button, so a single tap always works.
 *
 * The app link is only ever an allow-listed redirect plus a one-time code; it is still HTML-escaped,
 * and the script is static (allowed by its hash in the CSP), reading the link from the DOM.
 */
public final class AppReturnPage {

    private static final String SCRIPT =
            "var a=document.getElementById('open');if(a){window.location.replace(a.getAttribute('href'));}";

    public static final String CONTENT_SECURITY_POLICY =
            "default-src 'none'; style-src 'unsafe-inline'; script-src '" + sha256(SCRIPT) + "'; "
                    + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

    private AppReturnPage() {}

    public static String render(String appLink) {
        String href = escapeHtml(appLink);
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"referrer\" content=\"no-referrer\">"
                + "<title>SpotCheck</title>"
                + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;"
                + "justify-content:center;gap:24px;background:#111;color:#fff;font:18px system-ui,sans-serif;"
                + "text-align:center;padding:24px;box-sizing:border-box}"
                + "a{display:inline-block;padding:16px 28px;border-radius:28px;background:#fff;color:#111;"
                + "font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:.5px}</style>"
                + "</head><body>"
                + "<p>Signed in with Google. Returning to SpotCheck&hellip;</p>"
                + "<a id=\"open\" href=\"" + href + "\">Open SpotCheck</a>"
                + "<script>" + SCRIPT + "</script>"
                + "</body></html>";
    }

    static String escapeHtml(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (char c : value.toCharArray()) {
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

    private static String sha256(String script) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(script.getBytes(StandardCharsets.UTF_8));
            return "sha256-" + Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
