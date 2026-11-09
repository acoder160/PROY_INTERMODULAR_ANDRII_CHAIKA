import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Botón oficial "Continuar con Google". Google devuelve un ID token, el backend lo verifica
 * (POST /api/auth/google) y abre una sesión normal de SpotCheck. Sin VITE_GOOGLE_CLIENT_ID no se muestra.
 */
export default function GoogleSignInButton() {
  const { t, i18n } = useTranslation();
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async ({ credential }) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      navigate('/map');
    } catch {
      setError(t('auth.wrongCredentials'));
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="auth-divider" aria-hidden="true" />
      {error && <div className="error-message">{error}</div>}
      <div className="google-button">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError(t('auth.wrongCredentials'))}
          text="continue_with"
          shape="pill"
          size="large"
          theme="filled_black"
          width="300"
          locale={i18n.language}
        />
      </div>
    </GoogleOAuthProvider>
  );
}
