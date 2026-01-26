package skatemap.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    // CAMBIO IMPORTANTE: Renombramos 'text' a 'content' para coincidir con DTO y Frontend
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    // Relación: Muchos comentarios pertenecen a UN Spot
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spot_id", nullable = false)
    private Spot spot;

    // Relación: Muchos comentarios pertenecen a UN Usuario
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Comment() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // --- GETTERS Y SETTERS ACTUALIZADOS ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    // Aquí está la clave: getContent y setContent
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Spot getSpot() { return spot; }
    public void setSpot(Spot spot) { this.spot = spot; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}