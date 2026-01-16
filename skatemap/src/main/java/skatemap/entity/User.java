package skatemap.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Entity // Indica a Spring que esto es una tabla de BBDD
@Table(name = "users") // Nombre real de la tabla en Postgres
public class User {

    @Id // Clave primaria (Primary Key)
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto-incremental (1, 2, 3...)
    private Long id;

    @NotBlank // Valida que no esté vacío ni sea null
    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Email // Valida formato de email
    @NotBlank
    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @NotBlank
    private String password; // Se guardará encriptada

    @Column(name = "avatar_url")
    private String avatarUrl;

    private Integer reputation = 0; // Puntos de reputación, empieza en 0

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // CONSTRUCTOR VACÍO (Obligatorio para JPA)
    public User() {}

    // AUTOMATIZACIÓN: Antes de guardar, pon la fecha actual
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // GETTERS Y SETTERS (Necesarios para que Spring lea/escriba datos)
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

    public Integer getReputation() { return reputation; }
    public void setReputation(Integer reputation) { this.reputation = reputation; }
}