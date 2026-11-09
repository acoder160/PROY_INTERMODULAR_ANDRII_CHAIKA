package spotcheck.dto;

import jakarta.validation.constraints.NotBlank;

/** ID token devuelto por "Iniciar sesión con Google" en la web o en la app. */
public class GoogleLoginRequest {
    @NotBlank
    private String idToken;

    public String getIdToken() { return idToken; }
    public void setIdToken(String idToken) { this.idToken = idToken; }
}
