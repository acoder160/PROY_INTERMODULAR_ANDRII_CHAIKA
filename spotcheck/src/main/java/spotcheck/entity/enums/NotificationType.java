package spotcheck.entity.enums;

public enum NotificationType {
    /** actor started following the recipient */
    FOLLOW,
    /** actor commented on a spot the recipient added */
    COMMENT_ON_SPOT,
    /** actor replied to the recipient's comment */
    REPLY,
    /** actor liked the recipient's comment */
    COMMENT_LIKE,
    /** actor joined a session the recipient hosts */
    SESSION_JOINED,
    /** a session the recipient joined starts in about 30 minutes (actor = host) */
    SESSION_REMINDER,
    /** someone the recipient follows (actor) just checked in at a spot */
    FOLLOWEE_CHECKED_IN,
    /** the host (actor) changed the time or note of a session the recipient joined */
    SESSION_UPDATED,
    /** the host (actor) cancelled a session the recipient joined (the session is gone: spot only) */
    SESSION_CANCELLED
}
