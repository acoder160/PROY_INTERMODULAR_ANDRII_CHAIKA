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

@RestController
@RequestMapping("/api/spots")
@CrossOrigin(origins = "*") // Permite peticiones desde cualquier frontend
public class SpotController {

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    // 1. CREAR SPOT (Requiere Login)
    @PostMapping
    public ResponseEntity<SpotDto> createSpot(@RequestBody SpotDto spotDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        SpotDto newSpot = spotService.createSpot(spotDto, username);
        return ResponseEntity.ok(newSpot);
    }

    // 2. BUSCAR CERCANOS
    @GetMapping("/nearby")
    public ResponseEntity<List<SpotDto>> getNearbySpots(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5000") double dist) {

        List<SpotDto> spots = spotService.findSpotsNearby(lat, lng, dist);
        return ResponseEntity.ok(spots);
    }

    // 3. LISTAR TODOS
    @GetMapping
    public ResponseEntity<List<SpotDto>> getAllSpots() {
        return ResponseEntity.ok(spotService.getAllSpots());
    }

    // 4. VER COMENTARIOS DE UN SPOT
    @GetMapping("/{spotId}/comments")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long spotId) {
        // CORREGIDO: El método en el servicio se llama 'getCommentsBySpot'
        return ResponseEntity.ok(spotService.getCommentsBySpot(spotId));
    }

    // 5. VERIFICAR SI YA HE VOTADO
    @GetMapping("/{spotId}/my-rating")
    public ResponseEntity<RatingDto> getMyRating(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        // CORREGIDO: El método en el servicio se llama 'getUserRating'
        return ResponseEntity.ok(spotService.getUserRating(spotId, username));
    }
}