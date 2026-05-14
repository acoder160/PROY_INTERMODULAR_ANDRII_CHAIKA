package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.CommentDto;
import skatemap.dto.RatingDto;
import skatemap.dto.SpotDto;
import skatemap.service.SpotService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spots")
public class SpotController {

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    // CREAR SPOT (Requiere Login)
    @PostMapping
    public ResponseEntity<SpotDto> createSpot(@RequestBody SpotDto spotDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        SpotDto newSpot = spotService.createSpot(spotDto, username);
        return ResponseEntity.ok(newSpot);
    }

    // BUSCAR CERCANOS
    @GetMapping("/nearby")
    public ResponseEntity<List<SpotDto>> getNearbySpots(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5000") double dist) {

        List<SpotDto> spots = spotService.findSpotsNearby(lat, lng, dist);
        return ResponseEntity.ok(spots);
    }

    // LISTAR TODOS
    @GetMapping
    public ResponseEntity<List<SpotDto>> getAllSpots() {
        return ResponseEntity.ok(spotService.getAllSpots());
    }

    // VER COMENTARIOS DE UN SPOT
    @GetMapping("/{spotId}/comments")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        return ResponseEntity.ok(spotService.getCommentsBySpot(spotId));
    }

    // VERIFICAR SI YA HE VOTADO
    @GetMapping("/{spotId}/my-rating")
    public ResponseEntity<RatingDto> getMyRating(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        return ResponseEntity.ok(spotService.getUserRating(spotId, username));
    }
    // BORRAR SPOT (Solo Admin "a")
    @DeleteMapping("/{spotId}")
    public ResponseEntity<?> deleteSpot(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        try {
            spotService.deleteSpot(spotId, username);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(e.getMessage()); // 403 Forbidden
        }
    }
}