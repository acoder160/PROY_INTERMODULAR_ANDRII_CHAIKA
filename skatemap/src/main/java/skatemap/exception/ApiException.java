package skatemap.exception;

import org.springframework.http.HttpStatus;

/**
 * Error whose message is safe to show to the client. Anything that is not an ApiException is
 * reported as a generic 500 so internal details never leak.
 *
 * {@code code} is an optional stable identifier (e.g. "photo_unclear") that clients map to a
 * translated text; {@code message} stays as the English fallback.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    /** Extra fields for the response body (e.g. the existing spot a new one duplicates). */
    private final java.util.Map<String, Object> details;

    public ApiException(HttpStatus status, String message) {
        this(status, null, message);
    }

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, java.util.Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public java.util.Map<String, Object> getDetails() {
        return details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    /** Content blocked by moderation; the message is shown to the user as-is. */
    public static ApiException contentRejected(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    /** Content blocked by moderation, with a code the clients translate. */
    public static ApiException contentRejected(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static ApiException unavailable(String message) {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
