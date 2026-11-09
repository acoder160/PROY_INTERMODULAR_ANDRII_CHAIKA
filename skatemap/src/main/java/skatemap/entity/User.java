package skatemap.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Entity
@Table(name = "users") // Nombre real de la tabla en Postgres
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Email // Valida formato de email
    @NotBlank
    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @NotBlank
    private String password;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @NotBlank
    @Column(nullable = false)
    private String role = "ROLE_USER";

    @Column(name = "token_version", nullable = false)
    private Long tokenVersion = 0L;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Reputación como denunciante: solo cambia con decisiones de un admin (V3). */
    @Column(name = "reports_upheld", nullable = false)
    private int reportsUpheld = 0;

    @Column(name = "reports_rejected", nullable = false)
    private int reportsRejected = 0;

    public User() {}

    // AUTOMATIZACIÓN: Antes de guardar, poner la fecha actual
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // GETTERS Y SETTERS
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Long getTokenVersion() { return tokenVersion; }
    public void setTokenVersion(Long tokenVersion) { this.tokenVersion = tokenVersion; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public int getReportsUpheld() { return reportsUpheld; }
    public void setReportsUpheld(int reportsUpheld) { this.reportsUpheld = reportsUpheld; }

    public int getReportsRejected() { return reportsRejected; }
    public void setReportsRejected(int reportsRejected) { this.reportsRejected = reportsRejected; }

    public boolean isAdmin() { return "ROLE_ADMIN".equals(role); }
}