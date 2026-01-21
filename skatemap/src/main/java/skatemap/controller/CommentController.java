package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.service.CommentService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comments")
@CrossOrigin(origins = "*")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    // AÑADIR COMENTARIO
    // POST /api/comments/{spotId}
    @PostMapping("/{spotId}")
    public ResponseEntity<CommentDto> addComment(@PathVariable Long spotId, @RequestBody Map<String, String> payload) {
        // Obtenemos el usuario del Token
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        // Extraemos el texto del JSON {"text": "Hola..."}
        String text = payload.get("text");

        CommentDto newComment = commentService.addComment(spotId, username, text);
        return ResponseEntity.ok(newComment);
    }

    // LEER COMENTARIOS DE UN SPOT
    // GET /api/comments/{spotId}
    @GetMapping("/{spotId}")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        List<CommentDto> comments = commentService.getCommentsBySpot(spotId);
        return ResponseEntity.ok(comments);
    }
}