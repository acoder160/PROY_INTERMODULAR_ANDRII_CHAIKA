package skatemap.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.ContentReport;

import java.util.List;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {

    boolean existsByReporterIdAndTargetTypeAndTargetId(Long reporterId, ContentReport.Target type, Long targetId);

    @EntityGraph(attributePaths = "reporter")
    List<ContentReport> findByStatusOrderByIdDesc(ContentReport.Status status, Pageable pageable);

    List<ContentReport> findByStatusAndTargetTypeAndTargetId(ContentReport.Status status, ContentReport.Target type, Long targetId);

    long countByStatus(ContentReport.Status status);

    /** Reports filed by a deleted account go with it. */
    @Modifying
    @Query("DELETE FROM ContentReport r WHERE r.reporter.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
