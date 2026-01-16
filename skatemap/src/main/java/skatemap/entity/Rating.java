package skatemap.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;

@Entity
@Table(name = "ratings", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "spot_id"}) // Regla: 1 voto por usuario y spot
})
public class Rating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Min(1) @Max(5) // Validación: Solo de 1 a 5 estrellas
    @Column(name = "surface_rating", nullable = false)
    private Integer value;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spot_id", nullable = false)
    private Spot spot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Rating() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }
    public Spot getSpot() { return spot; }
    public void setSpot(Spot spot) { this.spot = spot; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}