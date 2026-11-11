package spotcheck.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import spotcheck.entity.Spot;
import spotcheck.entity.enums.PhotoStatus;
import spotcheck.entity.enums.SpotStatus;
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

    /** A user's spots for their profile, newest first, one page at a time. */
    @EntityGraph(attributePaths = "createdBy")
    List<Spot> findByCreatedBy_IdAndStatusOrderByIdDesc(Long userId, SpotStatus status, Pageable page);

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

    /** True when the point is within {@code meters} of the spot (real metres, on the sphere). */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM spots s WHERE s.id = :spotId AND "
            + "ST_DWithin(CAST(s.location AS geography), "
            + "CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography), :meters, false))",
            nativeQuery = true)
    boolean isWithin(@Param("spotId") Long spotId, @Param("latitude") double latitude,
                     @Param("longitude") double longitude, @Param("meters") double meters);

    /** A possible duplicate: an existing visible spot near the new one. */
    interface DuplicateCandidate {
        Long getId();
        Double getMeters();
        Double getSimilarity();
    }

    /**
     * Visible spots within {@code meters} of a point, closest first, with the trigram similarity of
     * their name to {@code name} (0..1, pg_trgm). The distance filter runs on idx_spots_location_geog.
     */
    @Query(value = "SELECT s.id AS id, "
            + "ST_Distance(CAST(s.location AS geography), CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography), false) AS meters, "
            + "similarity(lower(s.name), lower(:name)) AS similarity "
            + "FROM spots s WHERE s.status = 'VISIBLE' AND "
            + "ST_DWithin(CAST(s.location AS geography), CAST(ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) AS geography), :meters, false) "
            + "ORDER BY meters LIMIT 5",
            nativeQuery = true)
    List<DuplicateCandidate> duplicateCandidates(@Param("latitude") double latitude, @Param("longitude") double longitude,
                                                @Param("name") String name, @Param("meters") double meters);

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
