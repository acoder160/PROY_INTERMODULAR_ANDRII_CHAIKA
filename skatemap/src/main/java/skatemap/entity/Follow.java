package skatemap.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** follower follows followee. Unique per pair; following yourself is rejected by a CHECK (V5). */
@Entity
@Table(name = "follows")
public class Follow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "follower_id", nullable = false)
    private User follower;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "followee_id", nullable = false)
    private User followee;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Follow() {}

    public Follow(User follower, User followee) {
        this.follower = follower;
        this.followee = followee;
    }

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public User getFollower() { return follower; }
    public User getFollowee() { return followee; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
