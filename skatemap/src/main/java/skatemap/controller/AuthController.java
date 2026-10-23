package skatemap.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import skatemap.dto.JwtResponse;
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
                isMobileClient(clientType) ? refreshToken.rawToken() : null));
    }

    // REGISTER
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest signUpRequest) {
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