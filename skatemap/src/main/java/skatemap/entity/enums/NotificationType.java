package skatemap.entity.enums;

public enum NotificationType {
    /** actor started following the recipient */
    FOLLOW,
    /** actor commented on a spot the recipient added */
    COMMENT_ON_SPOT,
    /** actor replied to the recipient's comment */
    REPLY,
    /** actor liked the recipient's comment */
    COMMENT_LIKE
}
