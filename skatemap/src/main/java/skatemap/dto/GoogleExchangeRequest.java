package skatemap.dto;

import jakarta.validation.constraints.NotBlank;

/** Canje del código de un solo uso del login con Google por navegador (con verificador PKCE). */
public class GoogleExchangeRequest {
    @NotBlank
    private String code;
    @NotBlank
    private String verifier;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getVerifier() { return verifier; }
    public void setVerifier(String verifier) { this.verifier = verifier; }
}
