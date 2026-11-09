package spotcheck.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class RegisterRequest {
    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_.-]{3,30}$",
            message = "Username must be 3-30 characters: letters, digits, '.', '_' or '-'")
    private String username;

    @NotBlank
    @Email
    @Size(max = 100)
    private String email;

    // BCrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated
    @NotBlank
    @Size(min = 8, max = 72, message = "Password must be 8-72 characters")
    private String password;

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
