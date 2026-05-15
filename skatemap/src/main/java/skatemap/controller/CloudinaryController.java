package skatemap.controller;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/cloudinary")
public class CloudinaryController {

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    @GetMapping("/signature")
    public ResponseEntity<Map<String, Object>> getSignature() {
        // Instanciamos Cloudinary
        Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret));

        // Generamos el timestamp, la firma caduca por la seguridad
        long timestamp = System.currentTimeMillis() / 1000L;

        // Parametros a firmar
        Map<String, Object> paramsToSign = new HashMap<>();
        paramsToSign.put("timestamp", timestamp);
        paramsToSign.put("folder", "skatemap_spots");

        // Firma criptográfica
        String signature = cloudinary.apiSignRequest(paramsToSign, apiSecret);

        // Devolvemos el info al movil
        Map<String, Object> response = new HashMap<>();
        response.put("signature", signature);
        response.put("timestamp", timestamp);
        response.put("api_key", apiKey);
        response.put("cloud_name", cloudName);

        return ResponseEntity.ok(response);
    }
}