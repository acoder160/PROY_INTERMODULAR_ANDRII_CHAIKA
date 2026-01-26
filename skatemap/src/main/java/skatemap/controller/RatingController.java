package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.RatingDto;
import skatemap.service.RatingService; // <--- OJO: Importamos el nuevo servicio

@RestController
@RequestMapping("/api/ratings")
@CrossOrigin(origins = "*")
public class RatingController {

    private final RatingService ratingService; // Usamos RatingService, NO SpotService

    public RatingController(RatingService ratingService) {
        this.ratingService = ratingService;
    }

    // POST: Guardar valoración
    @PostMapping("/{spotId}")
    public ResponseEntity<RatingDto> addRating(@PathVariable Long spotId, @RequestBody RatingDto ratingDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Llamamos al método corregido 'addRating'
        RatingDto result = ratingService.addRating(spotId, auth.getName(), ratingDto.getValue());

        return ResponseEntity.ok(result);
    }

    // GET: Verificar si ya voté
    @GetMapping("/check/{spotId}")
    public ResponseEntity<RatingDto> checkMyRating(@PathVariable Long spotId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Llamamos al método nuevo 'getUserRating'
        RatingDto myRating = ratingService.getUserRating(spotId, auth.getName());

        return ResponseEntity.ok(myRating);
    }
}