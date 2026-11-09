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

    /** A user's spots for their profile, newest first. */
    @EntityGraph(attributePaths = "createdBy")
    List<Spot> findByCreatedBy_IdAndStatusOrderByIdDesc(Long userId, SpotStatus status);

    long countByCreatedBy_IdAndStatus(Long userId, SpotStatus status);

    /**
     * Ids of visible spots within {@code distanceInMeters} of a point (PostGIS), nearest first.
     * Distances are real metres on a sphere (geography, use_spheroid=false: a bit faster than the
     * spheroid and precise enough for a few km). The cast is written out (CAST, not ::, which
     * Hibernate could read as a parameter) because the index that serves this query,
     * idx_spots_location_geog (V4), is on that exact expression.
     * Only ids: Hibernate can't apply an entity graph to a native query, so the caller loads the
     * spots with their authors through {@link #findAllByIdIn}.
     */
    @Query(value = "SELECT s.id FROM spots s WHERE s.status = 'VISIBLE' AND " +
            "ST_DWithin(CAST(s.location AS geography), " +
            "CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography), :distanceInMeters, false) " +
            "ORDER BY ST_Distance(CAST(s.location AS geography), " +
            "CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography), false)",
            nativeQuery = true)
    List<Long> findSpotIdsNearby(
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
