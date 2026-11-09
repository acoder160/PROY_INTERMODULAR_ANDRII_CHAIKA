import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import LanguageSwitcher from '../components/LanguageSwitcher';
import GoogleSignInButton from '../components/GoogleSignInButton';
import '../Auth.css';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  // isLoading bloquea el botón al instante
  const [isLoading, setIsLoading] = useState(false);
  // isWakingUp muestra el cartel verde solo si tarda mucho
  const [isWakingUp, setIsWakingUp] = useState(false);

  const navigate = useNavigate();

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
    setIsWakingUp(false);

    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      await api.post('/auth/register', formData);
      // El aviso de cuenta creada se muestra en la página de login (sin alert del navegador)
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError(t('auth.registerFailed'));
      }
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
        <h1 className="auth-title">{t('auth.joinCrew')}</h1>
        <p className="auth-subtitle">{t('auth.createAccountSubtitle')}</p>

        {/* Mensaje de Error */}
        {error && !isLoading && <div className="error-message" role="alert">{error}</div>}

        {isWakingUp && (
          <div className="loading-message" role="status">
            <span className="spinner" aria-hidden="true"></span>
            <p className="loading-text">{t('auth.wakingUp')}</p>
            <p className="loading-subtext">{t('auth.wakingUpHint')}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-username">{t('auth.username')}</label>
            <input
              type="text"
              name="username"
              id="register-username"
              className="form-input"
              placeholder={t('auth.registerUsernamePlaceholder')}
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              id="register-email"
              className="form-input"
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              id="register-password"
              className="form-input"
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </div>

          <label className="auth-consent">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
            />
            <span>
              {t('auth.acceptTerms')}{' '}
              <Link to="/legal" target="_blank" className="auth-link">{t('legal.link')}</Link>
            </span>
          </label>

          <button type="submit" className="auth-button" disabled={isLoading || !accepted}>
            {isLoading ? t('auth.registering') : t('auth.createAccount')}
          </button>
        </form>

        <GoogleSignInButton />

        <div className="auth-footer">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="auth-link">{t('auth.loginLink')}</Link>
        </div>
        <Link to="/map" className="auth-guest">{t('auth.backToMap')}</Link>
        <Link to="/legal" className="auth-legal">{t('legal.link')}</Link>
      </div>
    </div>
  );
}
