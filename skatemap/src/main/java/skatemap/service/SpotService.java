package skatemap.service;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import skatemap.dto.SpotDto;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.repository.SpotRepository;
import skatemap.repository.UserRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SpotService {

    private final SpotRepository spotRepository;
    private final UserRepository userRepository;

    // Factoría para crear puntos geoespaciales (SRID 4326 = GPS WGS84)
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    public SpotService(SpotRepository spotRepository, UserRepository userRepository) {
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
    }

    // CREAR UN SPOT
    public SpotDto createSpot(SpotDto spotDto, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Spot spot = new Spot();
        spot.setName(spotDto.getName());
        spot.setDescription(spotDto.getDescription());
        spot.setSpotType(spotDto.getSpotType());
        spot.setDifficultyLevel(spotDto.getDifficultyLevel());
        spot.setCreatedBy(user);

        // MAGIA GEOESPACIAL: Convertir lat/lon a Point
        // Nota: PostGIS usa orden (Longitud, Latitud) -> (X, Y)
        Point point = geometryFactory.createPoint(new Coordinate(spotDto.getLongitude(), spotDto.getLatitude()));
        spot.setLocation(point);

        Spot savedSpot = spotRepository.save(spot);
        return mapToDto(savedSpot);
    }

    // BUSCAR SPOTS CERCANOS
    public List<SpotDto> findSpotsNearby(double lat, double lng, double distanceMeters) {
        // Llamamos a la Query nativa que creamos hace 2 semanas en el repositorio
        List<Spot> spots = spotRepository.findSpotsNearby(lat, lng, distanceMeters);
        return spots.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // OBTENER TODOS
    public List<SpotDto> getAllSpots() {
        return spotRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // Helper: Convertir Entidad a DTO para devolver al frontend
    private SpotDto mapToDto(Spot spot) {
        SpotDto dto = new SpotDto();
        dto.setId(spot.getId());
        dto.setName(spot.getName());
        dto.setDescription(spot.getDescription());
        dto.setSpotType(spot.getSpotType());
        dto.setDifficultyLevel(spot.getDifficultyLevel());
        dto.setSurfaceRating(spot.getSurfaceRating());
        dto.setCreatedBy(spot.getCreatedBy().getUsername());

        // Extraer lat/lon del objeto Point
        if (spot.getLocation() != null) {
            dto.setLatitude(spot.getLocation().getY());  // Y es Latitud
            dto.setLongitude(spot.getLocation().getX()); // X es Longitud
        }
        return dto;
    }
}