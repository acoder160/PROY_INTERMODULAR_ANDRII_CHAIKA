package skatemap.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name="spot")
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(unique = true, nullable = false)
    private String location; //!!! PROBABLEMENTE NO ES UN STRING

    @Column(nullable = false)
    private String spotType;

    @Column(nullable = false)
    private String dificultyLevel;

    @Column(nullable = false)
    private String serfaceRating;

    @ManyToOne
    @JoinColumn(name="user_id", nullable = false)
    private User createdBy;

    private LocalDate createdAt;


    public Spot () {}

    // G && S

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getSpotType() {
        return spotType;
    }

    public void setSpotType(String spotType) {
        this.spotType = spotType;
    }

    public String getDificultyLevel() {
        return dificultyLevel;
    }

    public void setDificultyLevel(String dificultyLevel) {
        this.dificultyLevel = dificultyLevel;
    }

    public String getSerfaceRating() {
        return serfaceRating;
    }

    public void setSerfaceRating(String serfaceRating) {
        this.serfaceRating = serfaceRating;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDate getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDate createdAt) {
        this.createdAt = createdAt;
    }
}
