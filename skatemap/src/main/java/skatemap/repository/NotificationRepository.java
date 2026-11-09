package skatemap.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import skatemap.entity.Notification;
import skatemap.entity.enums.NotificationType;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** Newest first, keyset on id; served by idx_notifications_recipient. */
    @Query("SELECT n FROM Notification n JOIN FETCH n.actor "
            + "LEFT JOIN FETCH n.spot LEFT JOIN FETCH n.comment "
            + "WHERE n.recipient.id = :userId AND n.id < :before ORDER BY n.id DESC")
    List<Notification> page(@Param("userId") Long userId, @Param("before") Long before, Pageable pageable);

    long countByRecipientIdAndReadAtIsNull(Long recipientId);

    /** Liking, unliking and liking again must not notify twice. */
    boolean existsByRecipientIdAndActorIdAndTypeAndCommentId(Long recipientId, Long actorId,
                                                             NotificationType type, Long commentId);

    @Modifying
    @Query("UPDATE Notification n SET n.readAt = :now WHERE n.recipient.id = :userId AND n.readAt IS NULL")
    int markAllRead(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipient.id = :userId OR n.actor.id = :userId")
    int deleteAllOf(@Param("userId") Long userId);
}
