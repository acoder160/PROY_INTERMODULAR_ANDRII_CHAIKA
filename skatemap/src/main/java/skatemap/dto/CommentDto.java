package skatemap.dto;

import java.time.LocalDateTime;

public class CommentDto {
    private Long id;
    private String text;      // Lo que escribe el usuario
    private String username;  // Quién lo escribió
    private LocalDateTime createdAt;

    // Constructor vacío
    public CommentDto() {}

    // Constructor completo
    public CommentDto(Long id, String text, String username, LocalDateTime createdAt) {
        this.id = id;
        this.text = text;
        this.username = username;
        this.createdAt = createdAt;
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}