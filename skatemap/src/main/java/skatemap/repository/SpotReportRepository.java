package skatemap.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import skatemap.entity.SpotReport;
import skatemap.entity.enums.ReportStatus;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface SpotReportRepository extends JpaRepository<SpotReport, Long> {

    boolean existsBySpotIdAndReporterId(Long spotId, Long reporterId);

    /** Reports of a spot with their authors, newest first. */
    @EntityGraph(attributePaths = "reporter")
    List<SpotReport> findBySpotIdAndStatusInOrderByCreatedAtDesc(Long spotId, Collection<ReportStatus> statuses);

    @EntityGraph(attributePaths = "reporter")
    List<SpotReport> findBySpotIdInAndStatusInOrderByCreatedAtDesc(Collection<Long> spotIds, Collection<ReportStatus> statuses);

    /** Admin "reports" queue: spots with pending reports, heaviest first. */
    interface SpotScore {
        Long getSpotId();
        Double getScore();
        Long getReportCount();
    }

    @Query(value = "SELECT r.spot.id AS spotId, SUM(r.weight) AS score, COUNT(r) AS reportCount "
            + "FROM SpotReport r WHERE r.status IN :statuses "
            + "GROUP BY r.spot.id ORDER BY SUM(r.weight) DESC, MAX(r.createdAt) DESC",
            countQuery = "SELECT COUNT(DISTINCT r.spot.id) FROM SpotReport r WHERE r.status IN :statuses")
    Page<SpotScore> findSpotScores(@Param("statuses") Collection<ReportStatus> statuses, Pageable pageable);

    @Query("SELECT COUNT(DISTINCT r.spot.id) FROM SpotReport r WHERE r.status IN :statuses")
    long countSpotsWithStatus(@Param("statuses") Collection<ReportStatus> statuses);

    @Query("SELECT DISTINCT r.reporter.id FROM SpotReport r WHERE r.spot.id = :spotId AND r.status IN :statuses")
    List<Long> findReporterIds(@Param("spotId") Long spotId, @Param("statuses") Collection<ReportStatus> statuses);

    @Modifying
    @Query("UPDATE SpotReport r SET r.status = :to, r.resolvedAt = :now "
            + "WHERE r.spot.id = :spotId AND r.status IN :from")
    int resolve(@Param("spotId") Long spotId,
                @Param("from") Collection<ReportStatus> from,
                @Param("to") ReportStatus to,
                @Param("now") LocalDateTime now);

    @Modifying
    @Query("DELETE FROM SpotReport r WHERE r.spot.id = :spotId")
    void deleteBySpotId(@Param("spotId") Long spotId);
}
