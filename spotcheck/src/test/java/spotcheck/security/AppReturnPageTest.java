package spotcheck.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class AppReturnPageTest {

    @Test
    void linksBackToTheAppWithEscapedQuery() {
        String html = AppReturnPage.render("spotcheckmobile://auth/google?code=abc&x=1");
        assertTrue(html.contains("href=\"spotcheckmobile://auth/google?code=abc&amp;x=1\""), html);
        assertTrue(html.contains("Open SpotCheck"));
    }

    @Test
    void cannotBreakOutOfTheAttribute() {
        String html = AppReturnPage.render("exp://h/--/auth/google?code=\"><script>alert(1)</script>");
        assertFalse(html.contains("<script>alert"), html);
        assertTrue(html.contains("&quot;&gt;&lt;script&gt;"), html);
        // Exactly one script element: the static one
        assertEquals(1, html.split("<script>", -1).length - 1);
    }

    @Test
    void cspHashMatchesTheInlineScript() throws Exception {
        String html = AppReturnPage.render("spotcheckmobile://auth/google?code=abc");
        Matcher m = Pattern.compile("<script>(.*?)</script>").matcher(html);
        assertTrue(m.find());
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(m.group(1).getBytes(StandardCharsets.UTF_8));
        String hash = "sha256-" + Base64.getEncoder().encodeToString(digest);
        assertTrue(AppReturnPage.CONTENT_SECURITY_POLICY.contains("'" + hash + "'"), AppReturnPage.CONTENT_SECURITY_POLICY);
        assertTrue(AppReturnPage.CONTENT_SECURITY_POLICY.contains("default-src 'none'"));
    }
}
