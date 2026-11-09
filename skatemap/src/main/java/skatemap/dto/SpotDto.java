package skatemap.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;

public class SpotDto {
    private Long id;

    @NotBlank
    @Size(max = 100)
    private String name;

    @Size(max = 2000)
    private String description;

    // Lat/lon are sent separately because that is simpler for the clients
    @NotNull
    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    private Double latitude;

    @NotNull
    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    private Double longitude;

    @NotNull
    private SpotType spotType;

    @NotNull
    private DifficultyLevel difficultyLevel;

    private String createdBy; // only the username, never the whole user
    private Double surfaceRating;

    // Must point to our Cloudinary account; checked in SpotService
    @Size(max = 500)
    private String mediaUrl;

    /** Request only: create even though a possible duplicate was found (the user confirmed). */
    private Boolean force;

    public SpotDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public SpotType getSpotType() { return spotType; }
    public void setSpotType(SpotType spotType) { this.spotType = spotType; }
    public DifficultyLevel getDifficultyLevel() { return difficultyLevel; }
    public void setDifficultyLevel(DifficultyLevel difficultyLevel) { this.difficultyLevel = difficultyLevel; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Double getSurfaceRating() { return surfaceRating; }
    public void setSurfaceRating(Double surfaceRating) { this.surfaceRating = surfaceRating; }
    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    public Boolean getForce() { return force; }
    public void setForce(Boolean force) { this.force = force; }
}
