package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.GoogleLoginRequest;
import skatemap.dto.JwtResponse;
import skatemap.service.GoogleAuthService;
import skatemap.service.GoogleBrowserFlowService;
import skatemap.dto.GoogleExchangeRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import skatemap.dto.LoginRequest;
import skatemap.dto.RegisterRequest;
import skatemap.dto.RefreshTokenRequest;
import skatemap.entity.User;
import skatemap.repository.UserRepository;
import skatemap.security.JwtUtil;
import skatemap.security.UserDetailsServiceImpl;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import skatemap.service.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import skatemap.security.AppReturnPage;
import skatemap.exception.ApiException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtil jwtUtil;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    GoogleAuthService googleAuthService;

    @Autowired
    GoogleBrowserFlowService googleBrowserFlowService;

    /** Shared demo account so visitors (recruiters) can try the app without signing up. */
    @Value("${app.demo.enabled:false}")
    boolean demoEnabled;

    @Value("${app.demo.username:demo}")
    String demoUsername;

    // LOGIN
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(
            @Valid @RequestBody LoginRequest loginRequest,
            @RequestHeader(value = "X-Client-Type", required = false) String clientType) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtil.generateJwtToken(authentication);

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
        return issueSession(user, jwt, clientType);
    }

    // LOGIN CON GOOGLE: el cliente manda el ID token de Google; si es válido, sesión normal de SkateMap
    @PostMapping("/google")
    public ResponseEntity<?> authenticateWithGoogle(
            @Valid @RequestBody GoogleLoginRequest googleRequest,
            @RequestHeader(value = "X-Client-Type", required = false) String clientType) {
        if (!googleAuthService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Error: Google sign-in is not configured on the server");
        }
        try {
            User user = googleAuthService.authenticate(googleRequest.getIdToken());
            return issueSession(user, jwtUtil.generateJwtToken(user.getUsername()), clientType);
        } catch (GoogleAuthService.InvalidGoogleTokenException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Error: " + e.getMessage());
        }
    }

    // LOGIN CON GOOGLE POR NAVEGADOR (Expo Go): 1) la app abre esta URL en el navegador del sistema
    @GetMapping("/google/start")
    public ResponseEntity<?> startGoogleBrowserFlow(
            @RequestParam("redirect") String appRedirect,
            @RequestParam("challenge") String challenge) {
        if (!googleBrowserFlowService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Error: Google browser sign-in is not configured on the server");
        }
        try {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(googleBrowserFlowService.buildGoogleAuthUrl(appRedirect, challenge)))
                    .build();
        } catch (GoogleBrowserFlowService.BrowserFlowException e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    // 2) Google comes back here; a small page hands the one-time code back to the app
    @GetMapping("/google/callback")
    public ResponseEntity<?> googleBrowserCallback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "error", required = false) String error) {
        try {
            String appLink = googleBrowserFlowService.handleCallback(code, state, error);
            return ResponseEntity.ok()
                    .contentType(new MediaType(MediaType.TEXT_HTML, java.nio.charset.StandardCharsets.UTF_8))
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header("Referrer-Policy", "no-referrer")
                    .header("Content-Security-Policy", AppReturnPage.CONTENT_SECURITY_POLICY)
                    .body(AppReturnPage.render(appLink));
        } catch (GoogleBrowserFlowService.BrowserFlowException e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    // 3) La app canjea el código (con su verificador PKCE) por la sesión normal
    @PostMapping("/google/exchange")
    public ResponseEntity<?> exchangeGoogleBrowserCode(
            @Valid @RequestBody GoogleExchangeRequest exchangeRequest,
            @RequestHeader(value = "X-Client-Type", required = false) String clientType) {
        try {
            Long userId = googleBrowserFlowService.exchange(exchangeRequest.getCode(), exchangeRequest.getVerifier());
            User user = userRepository.findById(userId).orElseThrow();
            return issueSession(user, jwtUtil.generateJwtToken(user.getUsername()), clientType);
        } catch (GoogleBrowserFlowService.BrowserFlowException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Error: " + e.getMessage());
        }
    }

    // DEMO: a normal session for the shared demo user (created by DemoAccountInitializer).
    // It goes through the same moderation as everyone, with tighter per-IP limits.
    @PostMapping("/demo")
    public ResponseEntity<?> demoLogin(@RequestHeader(value = "X-Client-Type", required = false) String clientType) {
        if (!demoEnabled) throw ApiException.notFound("Demo");
        User user = userRepository.findByUsername(demoUsername)
                .orElseThrow(() -> ApiException.unavailable("Demo account is not ready"));
        return issueSession(user, jwtUtil.generateJwtToken(user.getUsername()), clientType);
    }

    /** Respuesta de login común: access token + refresh (cookie en la web, en el cuerpo para la app). */
    private ResponseEntity<?> issueSession(User user, String jwt, String clientType) {
        RefreshTokenService.IssuedRefreshToken refreshToken = refreshTokenService.createSession(user);

        ResponseEntity.BodyBuilder response = ResponseEntity.ok();
        if (!isMobileClient(clientType)) {
            response.header(HttpHeaders.SET_COOKIE,
                    refreshTokenService.createCookie(refreshToken.rawToken()).toString());
        }
        return response.body(new JwtResponse(jwt,
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                isMobileClient(clientType) ? refreshToken.rawToken() : null));
    }

    // REGISTER
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest signUpRequest) {
        // "me" would clash with /api/users/me; "deleted_*" is how deleted accounts are renamed
        String wanted = signUpRequest.getUsername().toLowerCase(java.util.Locale.ROOT);
        if (wanted.equals("me") || wanted.startsWith("deleted_")) {
            return ResponseEntity.badRequest().body("Error: Username is already taken!");
        }
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity.badRequest().body("Error: Username is already taken!");
        }

        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest().body("Error: Email is already in use!");
        }

        // Crear nuevo usuario
        User user = new User();
        user.setUsername(signUpRequest.getUsername());
        user.setEmail(signUpRequest.getEmail());
        user.setPassword(encoder.encode(signUpRequest.getPassword())); // ¡Encriptar pass!

        userRepository.save(user);

        return ResponseEntity.ok("User registered successfully!");
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshHeader,
            @RequestBody(required = false) RefreshTokenRequest refreshRequest) {
        refreshTokenValue(request, refreshHeader, refreshRequest)
                    .map(RefreshTokenInput::rawToken)
                    .ifPresent(refreshTokenService::revoke);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenService.clearCookie().toString())
                .build();
    }

    @PostMapping("/logout-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logoutAll(Authentication authentication, HttpServletRequest request) {
        User user = userRepository.findByUsername(authentication.getName()).orElseThrow();
        // The demo account is shared: one visitor must not sign out everybody else
        if (demoEnabled && user.getUsername().equals(demoUsername)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "demo_readonly", "Not available on the demo account");
        }
        refreshTokenService.revokeAll(user);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenService.clearCookie().toString())
                .build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            HttpServletRequest request,
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshHeader,
            @RequestBody(required = false) RefreshTokenRequest refreshRequest,
            @RequestHeader(value = "X-Client-Type", required = false) String clientType) {
        try {
            RefreshTokenInput tokenInput = refreshTokenValue(request, refreshHeader, refreshRequest)
                    .orElseThrow(() -> new IllegalArgumentException("Refresh token is missing"));
            RefreshTokenService.IssuedRefreshToken rotated = refreshTokenService.rotate(tokenInput.rawToken());
            User user = rotated.user();
            ResponseEntity.BodyBuilder response = ResponseEntity.ok();
            if (tokenInput.fromCookie()) {
                response.header(HttpHeaders.SET_COOKIE,
                        refreshTokenService.createCookie(rotated.rawToken()).toString());
            }
            return response.body(new JwtResponse(
                            jwtUtil.generateJwtToken(user.getUsername()),
                            user.getId(),
                            user.getUsername(),
                            user.getEmail(),
                            user.getRole(),
                            tokenInput.fromCookie() ? null : rotated.rawToken()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(401)
                    .header(HttpHeaders.SET_COOKIE, refreshTokenService.clearCookie().toString())
                    .build();
        }
    }

    private java.util.Optional<RefreshTokenInput> refreshTokenValue(
            HttpServletRequest request,
            String refreshHeader,
            RefreshTokenRequest refreshRequest) {
        if (refreshHeader != null && !refreshHeader.isBlank()) {
            return java.util.Optional.of(new RefreshTokenInput(refreshHeader, false));
        }
        if (refreshRequest != null
                && refreshRequest.refreshToken() != null
                && !refreshRequest.refreshToken().isBlank()) {
            return java.util.Optional.of(new RefreshTokenInput(refreshRequest.refreshToken(), false));
        }
        return refreshCookie(request).map(token -> new RefreshTokenInput(token, true));
    }

    private java.util.Optional<String> refreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return java.util.Optional.empty();
        for (Cookie cookie : request.getCookies()) {
            if (RefreshTokenService.COOKIE_NAME.equals(cookie.getName())) {
                return java.util.Optional.of(cookie.getValue());
            }
        }
        return java.util.Optional.empty();
    }

    private boolean isMobileClient(String clientType) {
        return "mobile".equalsIgnoreCase(clientType);
    }

    private record RefreshTokenInput(String rawToken, boolean fromCookie) {}
}