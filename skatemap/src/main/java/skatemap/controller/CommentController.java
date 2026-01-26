package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.service.SpotService;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
@CrossOrigin(origins = "*")
public class CommentController {

    private final SpotService spotService;

    public CommentController(SpotService spotService) {
        this.spotService = spotService;
    }

    // 1. GUARDAR COMENTARIO (POST /api/comments/{spotId})
    @PostMapping("/{spotId}")
    public ResponseEntity<?> addComment(@PathVariable Long spotId, @RequestBody CommentDto commentDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Llamamos al servicio
        spotService.addComment(spotId, commentDto.getContent(), auth.getName());

        return ResponseEntity.ok().build();
    }

    // 2. LEER COMENTARIOS (GET /api/comments/spot/{spotId})
    @GetMapping("/spot/{spotId}")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        return ResponseEntity.ok(spotService.getCommentsBySpot(spotId));
    }
}