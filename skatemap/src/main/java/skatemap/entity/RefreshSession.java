package skatemap.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "refresh_sessions",
        indexes = {
                @Index(name = "idx_refresh_sessions_user_id", columnList = "user_id"),
                @Index(name = "idx_refresh_sessions_family_id", columnList = "family_id")
        }
)
public class RefreshSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "family_id", nullable = false, columnDefinition = "uuid")
    private UUID familyId;

    @Column(name = "reuse_detected", nullable = false)
    private boolean reuseDetected = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (familyId == null) {
            familyId = UUID.randomUUID();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }

    public UUID getFamilyId() { return familyId; }
    public void setFamilyId(UUID familyId) { this.familyId = familyId; }

    public boolean isReuseDetected() { return reuseDetected; }
    public void setReuseDetected(boolean reuseDetected) { this.reuseDetected = reuseDetected; }
}
