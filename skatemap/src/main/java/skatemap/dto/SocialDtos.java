package skatemap.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import skatemap.entity.Spot;
import skatemap.entity.User;
import skatemap.entity.enums.ActivityType;
import skatemap.entity.enums.DifficultyLevel;
import skatemap.entity.enums.NotificationType;
import skatemap.entity.enums.PhotoStatus;
import skatemap.entity.enums.SpotType;

import java.time.LocalDateTime;
import java.util.List;

/** Request and response shapes of the social endpoints (profiles, follows, feed, notifications). */
public final class SocialDtos {

    private SocialDtos() {}

    /** Who did something, as shown next to it. A deleted account shows as {@code deleted=true}. */
    public record UserSummary(String username, String avatarUrl, boolean deleted) {
        public static UserSummary of(User user) {
            return user.isDeleted()
                    ? new UserSummary(null, null, true)
                    : new UserSummary(user.getUsername(), user.getAvatarUrl(), false);
        }
    }

    /** List entry with the viewer's follow state, for follower / following lists. */
    public record UserListItem(String username, String avatarUrl, boolean followedByMe) {}

    public record Me(Long id, String username, String email, String role, String bio, String avatarUrl,
                     LocalDateTime createdAt, boolean demo) {}

    public record Profile(String username, String avatarUrl, String bio, LocalDateTime createdAt,
                          long spots, long ratings, long comments, long followers, long following,
                          boolean followedByMe, boolean me, boolean blockedByMe) {}

    /** PATCH /api/users/me. Null leaves a field as it is; "" clears it. */
    public record ProfileUpdate(@Size(max = 280) String bio, @Size(max = 500) String avatarUrl) {}

    public record FollowState(boolean following, long followers) {}

    public record LikeState(boolean liked, long likes) {}

    /** Enough of a spot to show a card and fly the map to it. */
    public record SpotSummary(Long id, String name, String mediaUrl, SpotType spotType, Double latitude, Double longitude) {
        public static SpotSummary of(Spot spot) {
            if (spot == null) return null;
            return new SpotSummary(spot.getId(), spot.getName(),
                    spot.getPhotoStatus() == PhotoStatus.HIDDEN ? null : spot.getMediaUrl(),
                    spot.getSpotType(),
                    spot.getLocation() == null ? null : spot.getLocation().getY(),
                    spot.getLocation() == null ? null : spot.getLocation().getX());
        }
    }

    /** The session a feed item or notification is about; {@code startsAt} is an instant (UTC). */
    public record SessionRef(Long id, java.time.Instant startsAt) {}

    public record FeedItem(Long id, ActivityType type, UserSummary actor, SpotSummary spot,
                           String comment, Short rating, SessionRef session, LocalDateTime createdAt) {}

    public record NotificationItem(Long id, NotificationType type, UserSummary actor, SpotSummary spot,
                                   Long commentId, String comment, SessionRef session, boolean read, LocalDateTime createdAt) {}

    public record CheckinRequest(@NotNull @jakarta.validation.constraints.DecimalMin("-90.0") @jakarta.validation.constraints.DecimalMax("90.0") Double latitude,
                                 @NotNull @jakarta.validation.constraints.DecimalMin("-180.0") @jakarta.validation.constraints.DecimalMax("180.0") Double longitude) {}

    public record SessionCreate(@NotNull java.time.Instant startsAt, @Size(max = 200) String note) {}

    /** One page of a keyset-paginated list. {@code nextCursor} goes in {@code ?before=}; null = last page. */
    public record CursorPage<T>(List<T> items, Long nextCursor) {}

    public record NotificationPage(List<NotificationItem> items, Long nextCursor, long unread) {}

    public record PushTokenRequest(@NotBlank @Size(max = 255) String token,
                                   @Size(max = 16) String platform,
                                   @Size(max = 16) String locale) {}

    /** What an author may change on their own spot. Location and photo stay: they were checked on site. */
    public record SpotUpdate(@NotBlank @Size(max = 100) String name,
                             @Size(max = 2000) String description,
                             @NotNull SpotType spotType,
                             @NotNull DifficultyLevel difficultyLevel) {}

    public record CommentEdit(@NotBlank @Size(max = 1000) String content) {}
}
