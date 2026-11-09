package spotcheck.entity;

import jakarta.persistence.*;
import spotcheck.entity.enums.ActivityType;

import java.time.LocalDateTime;

/** One line of someone's public activity; the feed reads these for the people you follow. */
@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ActivityType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spot_id")
    private Spot spot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comment_id")
    private Comment comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private SkateSession session;

    /** Stars, for RATED. */
    @Column(name = "rating")
    private Short rating;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Activity() {}

    public Activity(User actor, ActivityType type, Spot spot, Comment comment, Short rating) {
        this.actor = actor;
        this.type = type;
        this.spot = spot;
        this.comment = comment;
        this.rating = rating;
    }

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public User getActor() { return actor; }
    public ActivityType getType() { return type; }
    public Spot getSpot() { return spot; }
    public Comment getComment() { return comment; }
    public SkateSession getSession() { return session; }
    public void setSession(SkateSession session) { this.session = session; }
    public Short getRating() { return rating; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
