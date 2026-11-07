package skatemap.controller;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import skatemap.exception.ApiException;
import skatemap.repository.UserRepository;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Issues short-lived signatures for direct client uploads to Cloudinary.
 *
 * Everything in {@code params} is covered by the signature, so the client must send those values
 * unchanged: uploads are limited to image formats, oversized photos are scaled down on arrival,
 * and each user uploads into their own folder (easy to audit or clean up).
 */
@RestController
@RequestMapping("/api/cloudinary")
public class CloudinaryController {

    static final String ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic";
    static final String INCOMING_TRANSFORMATION = "c_limit,w_2048,h_2048";

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    private final UserRepository userRepository;

    public CloudinaryController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/signature")
    public ResponseEntity<Map<String, Object>> getSignature(Authentication authentication) {
        Long userId = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> ApiException.notFound("User"))
                .getId();

        Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret));

        // Cloudinary rejects signatures older than one hour
        long timestamp = System.currentTimeMillis() / 1000L;

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("folder", "skatemap_spots/u" + userId);
        params.put("allowed_formats", ALLOWED_FORMATS);
        params.put("transformation", INCOMING_TRANSFORMATION);

        Map<String, Object> toSign = new HashMap<>(params);
        toSign.put("timestamp", timestamp);
        String signature = cloudinary.apiSignRequest(toSign, apiSecret);

        Map<String, Object> response = new HashMap<>();
        response.put("signature", signature);
        response.put("timestamp", timestamp);
        response.put("api_key", apiKey);
        response.put("cloud_name", cloudName);
        response.put("params", params);
        return ResponseEntity.ok(response);
    }
}
