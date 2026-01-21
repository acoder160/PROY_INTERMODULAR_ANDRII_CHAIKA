package skatemap.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
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
        // Obtenemos el usuario autenticado automáticamente gracias al Token JWT
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        SpotDto newSpot = spotService.createSpot(spotDto, username);
        return ResponseEntity.ok(newSpot);
    }

    // 2. BUSCAR CERCANOS (Público o Privado según decidas)
    // Ejemplo: GET /api/spots/nearby?lat=40.41&lng=-3.70&dist=5000
    @GetMapping("/nearby")
    public ResponseEntity<List<SpotDto>> getNearbySpots(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5000") double dist) { // 5km por defecto

        List<SpotDto> spots = spotService.findSpotsNearby(lat, lng, dist);
        return ResponseEntity.ok(spots);
    }

    // 3. LISTAR TODOS
    @GetMapping
    public ResponseEntity<List<SpotDto>> getAllSpots() {
        return ResponseEntity.ok(spotService.getAllSpots());
    }
}