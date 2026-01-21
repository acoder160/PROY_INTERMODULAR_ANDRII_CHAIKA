package skatemap.dto;

import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.SpotType;

public class SpotDto {
    private Long id;
    private String name;
    private String description;

    // Recibimos Lat/Lon por separado (más fácil para el frontend)
    private Double latitude;
    private Double longitude;

    private SpotType spotType;
    private DifficultyLevel difficultyLevel;

    private String createdBy; // Devolvemos el nombre del usuario, no el objeto entero
    private Double surfaceRating;

    // Constructores, Getters y Setters
    public SpotDto() {}

    // Getters y Setters
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
}