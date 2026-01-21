package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.RatingDto;
import skatemap.service.RatingService;

@RestController
@RequestMapping("/api/ratings")
@CrossOrigin(origins = "*")
public class RatingController {

    private final RatingService ratingService;

    public RatingController(RatingService ratingService) {
        this.ratingService = ratingService;
    }

    // POST /api/ratings/{spotId}
    // Body: { "value": 5 }
    @PostMapping("/{spotId}")
    public ResponseEntity<RatingDto> rateSpot(@PathVariable Long spotId, @RequestBody RatingDto ratingDto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        RatingDto result = ratingService.rateSpot(spotId, username, ratingDto.getValue());

        return ResponseEntity.ok(result);
    }
}