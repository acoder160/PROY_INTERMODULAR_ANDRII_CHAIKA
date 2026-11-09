package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.dto.SocialDtos.CommentEdit;
import skatemap.dto.SocialDtos.LikeState;
import skatemap.service.CommentService;

/** Writing comments. Reading them is GET /api/spots/{id}/comments. */
@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /** New comment on a spot; with {@code parentId} it is a reply. */
    @PostMapping("/{spotId}")
    public ResponseEntity<CommentDto> addComment(@PathVariable Long spotId, @Valid @RequestBody CommentDto commentDto,
                                                 Authentication auth) {
        return ResponseEntity.ok(commentService.add(spotId, commentDto.getContent(), commentDto.getParentId(), auth.getName()));
    }

    @PatchMapping("/{commentId}")
    public ResponseEntity<CommentDto> edit(@PathVariable Long commentId, @Valid @RequestBody CommentEdit edit,
                                           Authentication auth) {
        return ResponseEntity.ok(commentService.edit(commentId, edit.content(), auth.getName()));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long commentId, Authentication auth) {
        commentService.delete(commentId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{commentId}/like")
    public ResponseEntity<LikeState> like(@PathVariable Long commentId, Authentication auth) {
        return ResponseEntity.ok(commentService.like(commentId, auth.getName()));
    }

    @DeleteMapping("/{commentId}/like")
    public ResponseEntity<LikeState> unlike(@PathVariable Long commentId, Authentication auth) {
        return ResponseEntity.ok(commentService.unlike(commentId, auth.getName()));
    }
}
