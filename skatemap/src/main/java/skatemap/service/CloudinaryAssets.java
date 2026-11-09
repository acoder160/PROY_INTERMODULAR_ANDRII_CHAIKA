package skatemap.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Deletes spot photos from Cloudinary. Removing a spot or rejecting a photo must also delete the
 * file: otherwise the image stays public at its URL even though the app no longer shows it.
 */
@Component
public class CloudinaryAssets {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryAssets.class);
    static final String ROOT_FOLDER = "skatemap_spots/";
    private static final String UPLOAD_SEGMENT = "/image/upload/";

    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryAssets(@Value("${cloudinary.cloud-name:}") String cloudName,
                            @Value("${cloudinary.api-key:}") String apiKey,
                            @Value("${cloudinary.api-secret:}") String apiSecret) {
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    /**
     * public_id of one of our spot photos ("skatemap_spots/u12/abc"), or empty for anything else.
     * Accepts URLs with or without a version and transformation segments.
     */
    static Optional<String> publicIdOf(String mediaUrl) {
        if (mediaUrl == null || !mediaUrl.startsWith("https://res.cloudinary.com/")) return Optional.empty();
        int upload = mediaUrl.indexOf(UPLOAD_SEGMENT);
        if (upload < 0) return Optional.empty();
        String path = mediaUrl.substring(upload + UPLOAD_SEGMENT.length());
        int query = path.indexOf('?');
        if (query >= 0) path = path.substring(0, query);
        int root = path.indexOf(ROOT_FOLDER);
        if (root < 0) return Optional.empty();
        String publicId = path.substring(root);
        int dot = publicId.lastIndexOf('.');
        int slash = publicId.lastIndexOf('/');
        if (dot > slash) publicId = publicId.substring(0, dot);
        if (publicId.contains("..") || publicId.length() <= ROOT_FOLDER.length()) return Optional.empty();
        return Optional.of(publicId);
    }

    /** True if the photo was uploaded into this user's own folder (skatemap_spots/u{id}/). */
    static boolean isInUserFolder(String mediaUrl, Long userId) {
        return userId != null && publicIdOf(mediaUrl)
                .map(id -> id.startsWith(ROOT_FOLDER + "u" + userId + "/"))
                .orElse(false);
    }

    /** Smaller copy for the AI checks: faster to download and fewer image tokens. */
    static String previewUrl(String mediaUrl) {
        if (mediaUrl == null || !mediaUrl.contains(UPLOAD_SEGMENT)) return mediaUrl;
        return mediaUrl.replaceFirst("/image/upload/", "/image/upload/c_limit,w_768,q_auto/");
    }

    /** Deletes the photo and purges the CDN copy. Never throws: a failed delete is only logged. */
    public void destroy(String mediaUrl) {
        Optional<String> publicId = publicIdOf(mediaUrl);
        if (publicId.isEmpty()) return;
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            log.warn("Cloudinary not configured: photo {} was not deleted", publicId.get());
            return;
        }
        try {
            Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName, "api_key", apiKey, "api_secret", apiSecret));
            cloudinary.uploader().destroy(publicId.get(), ObjectUtils.asMap("invalidate", true));
        } catch (Exception e) {
            log.warn("Could not delete Cloudinary photo {}: {}", publicId.get(), e.getClass().getSimpleName());
        }
    }
}
