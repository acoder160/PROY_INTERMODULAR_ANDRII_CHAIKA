import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import GoogleSignInButton from '../components/GoogleSignInButton';
import '../Auth.css';

// Shared demo account (POST /api/auth/demo); the button only shows when the backend has it on
const DEMO_ENABLED = import.meta.env.VITE_DEMO_ENABLED === 'true';

export default function LoginPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  const navigate = useNavigate();
  const justRegistered = Boolean(useLocation().state?.registered);
  const { login, loginDemo } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleDemo = async () => {
    setError('');
    setIsDemoLoading(true);
    try {
      await loginDemo();
      navigate('/map');
    } catch {
      setError(t('auth.demoFailed'));
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsWakingUp(false); // Nos aseguramos de que empiece oculto

    // Si a los 3 segundos no ha terminado, mostramos el aviso.
    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      await login(formData.username, formData.password);
      navigate('/map');
    } catch {
      setError(t('auth.wrongCredentials'));
    } finally {
      clearTimeout(wakeUpTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  return (
    <div className="auth-container">
      <LanguageSwitcher variant="floating" />
      <div className="auth-card">
        <div className="brand-mark" aria-hidden="true">S</div>
        <h1 className="auth-title">{t('auth.welcomeBack')}</h1>
        <p className="auth-subtitle">{t('auth.tagline')}</p>

        {/* Mensaje de Error */}
        {justRegistered && !error && (
          <div className="success-message" role="status">
            <strong>{t('auth.welcomeTitle')}</strong> {t('auth.accountCreated')}
          </div>
        )}
        {error && !isLoading && !isDemoLoading && <div className="error-message" role="alert">{error}</div>}

        {isWakingUp && (
          <div className="loading-message" role="status">
            <span className="spinner" aria-hidden="true"></span>
            <p className="loading-text">{t('auth.wakingUp')}</p>
            <p className="loading-subtext">{t('auth.wakingUpHint')}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">{t('auth.username')}</label>
            <input
              type="text"
              name="username"
              id="login-username"
              className="form-input"
              placeholder={t('auth.usernamePlaceholder')}
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              id="login-password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>

        {DEMO_ENABLED && (
          <div className="demo-block">
            <button type="button" className="demo-button" onClick={handleDemo} disabled={isLoading || isDemoLoading}>
              {isDemoLoading ? t('auth.loggingIn') : t('auth.tryDemo')}
            </button>
            <p className="demo-hint">{t('auth.demoHint')}</p>
          </div>
        )}

        <GoogleSignInButton />

        <div className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="auth-link">{t('auth.registerHere')}</Link>
        </div>
        <Link to="/map" className="auth-guest">{t('auth.backToMap')}</Link>
        <Link to="/legal" className="auth-legal">{t('legal.link')}</Link>
      </div>
    </div>
  );
}
