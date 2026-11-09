package skatemap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class JwtResponse {
    private String token;
    private Long id;
    private String username;
    private String email;
    private String refreshToken;
    /** ROLE_USER or ROLE_ADMIN, so the clients know whether to show the moderation screens. */
    private String role;

    public JwtResponse(String token, Long id, String username, String email, String role) {
        this(token, id, username, email, role, null);
    }

    public JwtResponse(String token, Long id, String username, String email, String role, String refreshToken) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.email = email;
        this.role = role;
        this.refreshToken = refreshToken;
    }

    // Getters
    public String getToken() { return token; }
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getRefreshToken() { return refreshToken; }
    public String getRole() { return role; }
}
