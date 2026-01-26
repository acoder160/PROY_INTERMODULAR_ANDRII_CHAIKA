package skatemap.dto;

import java.time.LocalDateTime;

public class CommentDto {

    private Long id;
    private String content;
    private String username;
    private LocalDateTime createdAt;

    private Integer rating;

    // Constructor vacío (Necesario para que Spring lea el JSON)
    public CommentDto() {}

    // Constructor con todos los argumentos (Usado en tu Service)
    public CommentDto(Long id, String content, String username, LocalDateTime createdAt) {
        this.id = id;
        this.content = content;
        this.username = username;
        this.createdAt = createdAt;
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
}