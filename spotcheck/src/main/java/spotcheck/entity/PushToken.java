package spotcheck.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Expo push token of one device, owned by whoever signed in on it last. */
@Entity
@Table(name = "push_tokens")
public class PushToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 16)
    private String platform;

    /** App language, so the push text can be in it (en/es/ru, English otherwise). */
    @Column(length = 16)
    private String locale;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public PushToken() {}

    @PrePersist
    @PreUpdate
    protected void touch() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
}
