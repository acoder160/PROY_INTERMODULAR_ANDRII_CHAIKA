package skatemap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class JwtResponse {
    private String token;
    private Long id;
    private String username;
    private String email;
    private String refreshToken;

    public JwtResponse(String token, Long id, String username, String email) {
        this(token, id, username, email, null);
    }

    public JwtResponse(String token, Long id, String username, String email, String refreshToken) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.email = email;
        this.refreshToken = refreshToken;
    }

    // Getters
    public String getToken() { return token; }
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getRefreshToken() { return refreshToken; }
}