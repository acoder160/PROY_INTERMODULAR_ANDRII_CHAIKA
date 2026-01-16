package skatemap.dto;
import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    @NotBlank
    private String username; // Puede ser email también si cambias la lógica
    @NotBlank
    private String password;

    // Getters y Setters
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}