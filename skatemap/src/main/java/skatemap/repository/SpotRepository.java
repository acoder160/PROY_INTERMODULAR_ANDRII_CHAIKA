package skatemap.repository;

import skatemap.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpotRepository extends JpaRepository<Spot, Long> {

    // Buscar spots por usuario creador
    List<Spot> findByCreatedBy_Id(Long userId);

    /**
     * CONSULTA GEOESPACIAL (POSTGIS)
     * Busca spots que estén a menos de X metros de un punto dado.
     * ST_DWithin: Función de PostGIS que calcula si dos geometrías están dentro de una distancia.
     * ST_MakePoint: Crea un punto con la latitud/longitud que envías.
     * 4326: El sistema de coordenadas GPS mundial.
     * use_spheroid=false: Calcula distancia en esfera (más rápido).
     */
    @Query(value = "SELECT * FROM spots s WHERE " +
            "ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :distanceInMeters, false)",
            nativeQuery = true)
    List<Spot> findSpotsNearby(
            @Param("latitude") double latitude,
            @Param("longitude") double longitude,
            @Param("distanceInMeters") double distanceInMeters
    );
}