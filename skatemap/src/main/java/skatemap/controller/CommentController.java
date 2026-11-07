package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.service.SpotService;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final SpotService spotService;

    public CommentController(SpotService spotService) {
        this.spotService = spotService;
    }

    @PostMapping("/{spotId}")
    public ResponseEntity<Void> addComment(@PathVariable Long spotId, @Valid @RequestBody CommentDto commentDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        spotService.addComment(spotId, commentDto.getContent(), auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/spot/{spotId}")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        return SpotController.revalidate(spotService.getCommentsBySpot(spotId));
    }
}
