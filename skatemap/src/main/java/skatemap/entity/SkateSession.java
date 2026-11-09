package skatemap.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** A planned meet-up at a spot. */
@Entity
@Table(name = "skate_sessions")
public class SkateSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "spot_id", nullable = false)
    private Spot spot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(length = 200)
    private String note;

    @Column(name = "reminded_at")
    private LocalDateTime remindedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public SkateSession() {}

    public SkateSession(Spot spot, User host, LocalDateTime startsAt, String note) {
        this.spot = spot;
        this.host = host;
        this.startsAt = startsAt;
        this.note = note;
    }

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public Spot getSpot() { return spot; }
    public User getHost() { return host; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public String getNote() { return note; }
    public LocalDateTime getRemindedAt() { return remindedAt; }
    public void setRemindedAt(LocalDateTime remindedAt) { this.remindedAt = remindedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
