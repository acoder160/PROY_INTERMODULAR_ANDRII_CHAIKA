package skatemap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import skatemap.dto.SocialDtos.PushTokenRequest;
import skatemap.entity.Notification;
import skatemap.entity.PushToken;
import skatemap.entity.User;
import skatemap.repository.NotificationRepository;
import skatemap.repository.PushTokenRepository;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Push notifications through the Expo push service (it relays to FCM / APNs).
 * Sending runs after the transaction that created the notification has committed, on its own small
 * thread pool, so a slow or failing push never slows down or rolls back the request that caused it.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private static final URI EXPO_PUSH = URI.create("https://exp.host/--/api/v2/push/send");
    private static final Pattern EXPO_TOKEN = Pattern.compile("^Expo(nent)?PushToken\\[[A-Za-z0-9_-]{10,200}]$");

    private final PushTokenRepository pushTokenRepository;
    private final NotificationRepository notificationRepository;
    private final UserLookup userLookup;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public PushService(PushTokenRepository pushTokenRepository, NotificationRepository notificationRepository,
                       UserLookup userLookup, ObjectMapper objectMapper,
                       @Value("${app.push.enabled:true}") boolean enabled) {
        this.pushTokenRepository = pushTokenRepository;
        this.notificationRepository = notificationRepository;
        this.userLookup = userLookup;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    /** Stores or moves the device token to this user. The shared demo account gets no pushes. */
    @Transactional
    public void register(String username, PushTokenRequest request) {
        if (!EXPO_TOKEN.matcher(request.token()).matches()) {
            throw skatemap.exception.ApiException.contentRejected("Not an Expo push token");
        }
        User user = userLookup.require(username);
        if (userLookup.isDemo(user)) return;
        PushToken token = pushTokenRepository.findByToken(request.token()).orElseGet(PushToken::new);
        token.setToken(request.token());
        token.setUser(user);
        token.setPlatform(request.platform());
        token.setLocale(request.locale());
        pushTokenRepository.save(token);
    }

    /** On sign-out: this device stops getting this account's pushes. */
    @Transactional
    public void unregister(String username, String rawToken) {
        User user = userLookup.require(username);
        pushTokenRepository.findByToken(rawToken)
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .ifPresent(pushTokenRepository::delete);
    }

    @Async("pushExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onNotificationCreated(NotificationService.Created event) {
        if (!enabled) return;
        Notification n = notificationRepository.findById(event.notificationId()).orElse(null);
        if (n == null) return;
        List<PushToken> tokens = pushTokenRepository.findByUserId(n.getRecipient().getId());
        if (tokens.isEmpty()) return;

        List<Map<String, Object>> messages = new ArrayList<>();
        for (PushToken token : tokens) {
            String[] text = PushTexts.render(n, token.getLocale());
            Map<String, Object> message = new LinkedHashMap<>();
            message.put("to", token.getToken());
            message.put("title", text[0]);
            if (text[1] != null) message.put("body", text[1]);
            message.put("sound", "default");
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("type", n.getType().name());
            if (n.getSpot() != null) data.put("spotId", n.getSpot().getId());
            if (!n.getActor().isDeleted()) data.put("username", n.getActor().getUsername());
            message.put("data", data);
            messages.add(message);
        }
        send(messages, tokens);
    }

    private void send(List<Map<String, Object>> messages, List<PushToken> tokens) {
        try {
            HttpRequest request = HttpRequest.newBuilder(EXPO_PUSH)
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(messages)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.warn("Expo push answered {}", response.statusCode());
                return;
            }
            dropDeadTokens(objectMapper.readTree(response.body()).path("data"), tokens);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Push not sent: {}", e.getClass().getSimpleName());
        }
    }

    /** Tickets come back in the order of the messages; an uninstalled app reports DeviceNotRegistered. */
    private void dropDeadTokens(JsonNode tickets, List<PushToken> tokens) {
        List<String> dead = new ArrayList<>();
        for (int i = 0; i < tickets.size() && i < tokens.size(); i++) {
            JsonNode ticket = tickets.get(i);
            if ("error".equals(ticket.path("status").asText())
                    && "DeviceNotRegistered".equals(ticket.path("details").path("error").asText())) {
                dead.add(tokens.get(i).getToken());
            }
        }
        if (!dead.isEmpty()) pushTokenRepository.deleteByTokens(dead);
    }

    /** Push titles in the app's language for the three biggest locales; English for the rest. */
    static final class PushTexts {
        private PushTexts() {}

        static String[] render(Notification n, String locale) {
            String lang = locale == null ? "en" : locale.toLowerCase(Locale.ROOT);
            lang = lang.startsWith("es") ? "es" : lang.startsWith("ru") ? "ru" : "en";
            String actor = n.getActor().isDeleted() ? "SkateMap" : n.getActor().getUsername();
            String spot = n.getSpot() == null ? "" : n.getSpot().getName();
            String body = n.getComment() == null || n.getComment().isDeleted()
                    ? null : NotificationService.snippet(n.getComment().getContent());
            String title = switch (n.getType()) {
                case FOLLOW -> switch (lang) {
                    case "es" -> "Nuevo seguidor: " + actor;
                    case "ru" -> "Новый подписчик: " + actor;
                    default -> actor + " started following you";
                };
                case COMMENT_ON_SPOT -> switch (lang) {
                    case "es" -> actor + " comentó en " + spot;
                    case "ru" -> "Новый комментарий к «" + spot + "» от " + actor;
                    default -> actor + " commented on " + spot;
                };
                case REPLY -> switch (lang) {
                    case "es" -> actor + " respondió a tu comentario";
                    case "ru" -> "Ответ на ваш комментарий от " + actor;
                    default -> actor + " replied to your comment";
                };
                case COMMENT_LIKE -> switch (lang) {
                    case "es" -> "A " + actor + " le gustó tu comentario";
                    case "ru" -> "Лайк вашему комментарию от " + actor;
                    default -> actor + " liked your comment";
                };
                case SESSION_JOINED -> switch (lang) {
                    case "es" -> actor + " se apunta a tu sesión en " + spot;
                    case "ru" -> actor + " идёт на вашу сессию: " + spot;
                    default -> actor + " joined your session at " + spot;
                };
                case FOLLOWEE_CHECKED_IN -> switch (lang) {
                    case "es" -> actor + " está patinando en " + spot;
                    case "ru" -> actor + " катается на «" + spot + "»";
                    default -> actor + " is skating at " + spot;
                };
                case SESSION_REMINDER -> switch (lang) {
                    case "es" -> "Tu sesión en " + spot + " empieza pronto";
                    case "ru" -> "Сессия на «" + spot + "» скоро начнётся";
                    default -> "Your session at " + spot + " starts soon";
                };
            };
            return new String[]{title, body};
        }
    }
}
