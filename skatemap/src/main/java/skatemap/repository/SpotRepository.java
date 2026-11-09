package skatemap.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import skatemap.entity.Spot;
import skatemap.entity.enums.PhotoStatus;
import skatemap.entity.enums.SpotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface SpotRepository extends JpaRepository<Spot, Long> {

    @Override
    @EntityGraph(attributePaths = "createdBy")
    List<Spot> findAll();

    /** Public map: only spots that are not hidden by moderation. */
    @EntityGraph(attributePaths = "createdBy")
    List<Spot> findAllByStatus(SpotStatus status);

    @EntityGraph(attributePaths = "createdBy")
    List<Spot> findAllByIdIn(Collection<Long> ids);

    // Buscar spots por usuario creador
    List<Spot> findByCreatedBy_Id(Long userId);

    /**
     * CONSULTA GEOESPACIAL (POSTGIS)
     * Busca spots visibles que estén a menos de X metros de un punto dado.
     * ST_DWithin: Función de PostGIS que calcula si dos geometrías están dentro de una distancia.
     * ST_MakePoint: Crea un punto con la latitud/longitud que envías.
     * 4326: El sistema de coordenadas GPS mundial.
     * use_spheroid=false: Calcula distancia en esfera (más rápido).
     */
    @EntityGraph(attributePaths = "createdBy")
    @Query(value = "SELECT * FROM spots s WHERE s.status = 'VISIBLE' AND " +
            "ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :distanceInMeters, false)",
            nativeQuery = true)
    List<Spot> findSpotsNearby(
            @Param("latitude") double latitude,
            @Param("longitude") double longitude,
            @Param("distanceInMeters") double distanceInMeters
    );

    // --- Admin queues ---

    /** Spots no admin has looked at yet, newest first. */
    @EntityGraph(attributePaths = "createdBy")
    Page<Spot> findByReviewedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    long countByReviewedAtIsNull();

    /** Spots or photos hidden by the AI or the crowd threshold, waiting for a decision. */
    @EntityGraph(attributePaths = "createdBy")
    Page<Spot> findByStatusOrPhotoStatusOrderByIdDesc(SpotStatus status, PhotoStatus photoStatus, Pageable pageable);

    long countByStatusOrPhotoStatus(SpotStatus status, PhotoStatus photoStatus);

    @EntityGraph(attributePaths = "createdBy")
    Page<Spot> findAllByOrderByIdDesc(Pageable pageable);
}
