package skatemap.entity;

import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.PhotoStatus;
import skatemap.entity.enums.SpotStatus;
import skatemap.entity.enums.SpotType;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import java.time.LocalDateTime;

@Entity
@Table(name = "spots")
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Coordenadas geoespaciales (Latitud/Longitud)
    @Column(columnDefinition = "geometry(Point, 4326)", nullable = false)
    private Point location;

    @Enumerated(EnumType.STRING)
    @Column(name = "spot_type", nullable = false)
    private SpotType spotType;

    @Enumerated(EnumType.STRING)
    @Column(name = "difficulty_level", nullable = false)
    private DifficultyLevel difficultyLevel;

    @Column(name = "surface_rating")
    private Double surfaceRating = 0.0; // Promedio de valoraciones (caché)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "media_url", length = 500) // 500 por si la URL de Cloudinary es larga
    private String mediaUrl;

    // --- Moderación (V3) ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SpotStatus status = SpotStatus.VISIBLE;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_status", nullable = false, length = 16)
    private PhotoStatus photoStatus = PhotoStatus.OK;

    /** Cuándo lo revisó un admin; null = sigue en la cola de "nuevos". */
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    /** Peso de denuncias necesario para ocultarlo solo (sube después de que un admin lo mantenga). */
    @Column(name = "report_threshold", nullable = false)
    private int reportThreshold = 3;

    @Column(name = "ai_verdict", length = 16)
    private String aiVerdict;

    @Column(name = "ai_reason", columnDefinition = "TEXT")
    private String aiReason;

    @Column(name = "ai_checked_at")
    private LocalDateTime aiCheckedAt;

    public Spot() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Point getLocation() { return location; }
    public void setLocation(Point location) { this.location = location; }
    public SpotType getSpotType() { return spotType; }
    public void setSpotType(SpotType spotType) { this.spotType = spotType; }
    public DifficultyLevel getDifficultyLevel() { return difficultyLevel; }
    public void setDifficultyLevel(DifficultyLevel difficultyLevel) { this.difficultyLevel = difficultyLevel; }
    public Double getSurfaceRating() { return surfaceRating; }
    public void setSurfaceRating(Double surfaceRating) { this.surfaceRating = surfaceRating; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public SpotStatus getStatus() { return status; }
    public void setStatus(SpotStatus status) { this.status = status; }
    public PhotoStatus getPhotoStatus() { return photoStatus; }
    public void setPhotoStatus(PhotoStatus photoStatus) { this.photoStatus = photoStatus; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public int getReportThreshold() { return reportThreshold; }
    public void setReportThreshold(int reportThreshold) { this.reportThreshold = reportThreshold; }
    public String getAiVerdict() { return aiVerdict; }
    public void setAiVerdict(String aiVerdict) { this.aiVerdict = aiVerdict; }
    public String getAiReason() { return aiReason; }
    public void setAiReason(String aiReason) { this.aiReason = aiReason; }
    public LocalDateTime getAiCheckedAt() { return aiCheckedAt; }
    public void setAiCheckedAt(LocalDateTime aiCheckedAt) { this.aiCheckedAt = aiCheckedAt; }

    /** Visible en el mapa público. */
    public boolean isPublic() { return status == SpotStatus.VISIBLE; }
}