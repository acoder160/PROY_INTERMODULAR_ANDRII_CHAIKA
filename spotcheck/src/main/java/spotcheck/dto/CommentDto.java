package spotcheck.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A comment. As a request (POST /api/comments/{spotId}) only {@code content} and, for a reply,
 * {@code parentId} are read. As a response it carries the author, likes and the replies.
 */
public class CommentDto {

    private Long id;

    @NotBlank
    @Size(max = 1000)
    private String content;
    private String username;
    private String avatarUrl;
    /** The author deleted their account. */
    private boolean authorDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime editedAt;
    /** Deleted by its author but kept (without content) because it has replies. */
    private boolean deleted;

    /** The author's stars for this spot, if they rated it. */
    private Integer rating;

    private Long parentId;
    private long likeCount;
    private boolean likedByMe;
    private List<CommentDto> replies = new ArrayList<>();

    // Jackson needs the no-args constructor
    public CommentDto() {}

    public CommentDto(Long id, String content, String username, LocalDateTime createdAt) {
        this.id = id;
        this.content = content;
        this.username = username;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public boolean isAuthorDeleted() { return authorDeleted; }
    public void setAuthorDeleted(boolean authorDeleted) { this.authorDeleted = authorDeleted; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getEditedAt() { return editedAt; }
    public void setEditedAt(LocalDateTime editedAt) { this.editedAt = editedAt; }

    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }

    public long getLikeCount() { return likeCount; }
    public void setLikeCount(long likeCount) { this.likeCount = likeCount; }

    public boolean isLikedByMe() { return likedByMe; }
    public void setLikedByMe(boolean likedByMe) { this.likedByMe = likedByMe; }

    public List<CommentDto> getReplies() { return replies; }
    public void setReplies(List<CommentDto> replies) { this.replies = replies; }
}
