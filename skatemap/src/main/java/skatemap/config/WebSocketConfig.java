package skatemap.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import skatemap.entity.User;
import skatemap.repository.UserRepository;
import skatemap.security.JwtUtil;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

/**
 * Live map updates over STOMP on {@code /ws}. The data is public (how many skaters are at each spot)
 * and flows one way, server to clients, so guests may connect (the map is public too). A client that
 * sends {@code Authorization: Bearer <jwt>} in the CONNECT frame is authenticated: a bad or stale
 * token is refused, a good one becomes the session's principal. Either way a client may only
 * subscribe to {@link #LIVE_TOPIC}; any SEND or other subscription is refused.
 *
 * The broker is Spring's in-memory one: the app runs as a single instance. Scaling out would mean
 * a relay to a real broker (RabbitMQ STOMP, or Redis pub/sub) so every instance sees every update.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    public static final String LIVE_TOPIC = "/topic/live";

    private final String[] allowedOrigins;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    /**
     * {@code extraOrigins}: the API's own origin (e.g. https://api.example.com). React Native on
     * Android sends it as Origin, and Spring's same-origin check can't match it behind a TLS proxy.
     */
    public WebSocketConfig(@Value("${cors.allowed.origins}") String origins,
                           @Value("${app.ws.extra-origins:}") String extraOrigins,
                           JwtUtil jwtUtil, UserRepository userRepository) {
        this.allowedOrigins = Stream.of(origins, extraOrigins)
                .flatMap(list -> Arrays.stream(list.split(",")))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .distinct()
                .toArray(String[]::new);
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Browsers send an Origin header and must match the web app (or the API itself, for Android)
        registry.addEndpoint("/ws").setAllowedOrigins(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        ThreadPoolTaskScheduler heartbeat = new ThreadPoolTaskScheduler();
        heartbeat.setPoolSize(1);
        heartbeat.setThreadNamePrefix("ws-heartbeat-");
        heartbeat.initialize();
        // Heartbeats keep idle connections alive through proxies (Caddy) and phone networks
        registry.enableSimpleBroker("/topic").setHeartbeatValue(new long[]{20000, 20000}).setTaskScheduler(heartbeat);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() == null) return message; // heartbeats
                StompCommand command = accessor.getCommand();
                if (command == StompCommand.CONNECT) {
                    authenticate(accessor);
                }
                if (command == StompCommand.SUBSCRIBE && !LIVE_TOPIC.equals(accessor.getDestination())) {
                    throw new MessageDeliveryException("Only " + LIVE_TOPIC + " can be subscribed to");
                }
                if (command == StompCommand.SEND) {
                    throw new MessageDeliveryException("This connection is receive-only");
                }
                return message;
            }
        });
    }

    /** Optional JWT in the CONNECT frame: absent = guest, invalid = refused, valid = principal. */
    private void authenticate(StompHeaderAccessor accessor) {
        List<String> headers = accessor.getNativeHeader("Authorization");
        if (headers == null || headers.isEmpty()) return;
        String value = headers.get(0);
        String token = value != null && value.startsWith("Bearer ") ? value.substring(7) : null;
        if (token == null || !jwtUtil.validateJwtToken(token)) {
            throw new MessageDeliveryException("Invalid token");
        }
        User user = userRepository.findByUsername(jwtUtil.getUserNameFromJwtToken(token)).orElse(null);
        if (user == null || user.getTokenVersion() != jwtUtil.getTokenVersion(token)) {
            throw new MessageDeliveryException("Invalid token");
        }
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                user.getUsername(), null, AuthorityUtils.NO_AUTHORITIES));
    }
}
