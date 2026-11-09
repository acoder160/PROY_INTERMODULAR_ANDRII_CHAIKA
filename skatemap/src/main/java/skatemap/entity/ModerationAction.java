package skatemap.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** One admin decision. Kept after the spot or comment is deleted (no foreign keys). */
@Entity
@Table(name = "moderation_actions")
public class ModerationAction {

    public enum Type { KEEP, REMOVE_SPOT, REMOVE_PHOTO, RESTORE_PHOTO, DELETE_COMMENT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "spot_id")
    private Long spotId;

    @Column(name = "spot_name", length = 100)
    private String spotName;

    @Column(name = "author_username", length = 50)
    private String authorUsername;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Type action;

    @Column(length = 500)
    private String reason;

    @Column(name = "admin_username", length = 50)
    private String adminUsername;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public ModerationAction() {}

    public ModerationAction(Long spotId, String spotName, String authorUsername, Type action, String reason, String adminUsername) {
        this.spotId = spotId;
        this.spotName = spotName;
        this.authorUsername = authorUsername;
        this.action = action;
        this.reason = reason == null || reason.length() <= 500 ? reason : reason.substring(0, 500);
        this.adminUsername = adminUsername;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getSpotId() { return spotId; }
    public String getSpotName() { return spotName; }
    public String getAuthorUsername() { return authorUsername; }
    public Type getAction() { return action; }
    public String getReason() { return reason; }
    public String getAdminUsername() { return adminUsername; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
