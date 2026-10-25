import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import '../Auth.css';

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
  const { login } = useAuth();

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
    } catch (err) {
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
        <p className="auth-eyebrow">SKATEMAP / EXPLORE MORE</p>
        <h1 className="auth-title">{t('auth.welcomeBack')}</h1>
        <p className="auth-subtitle">{t('auth.tagline')}</p>

        {/* Mensaje de Error */}
        {error && !isLoading && <div className="error-message">{error}</div>}

        {isWakingUp && (
          <div className="loading-message">
            <div className="spinner"></div>
            <p className="loading-text">{t('auth.wakingUp')}</p>
            <p className="loading-subtext">{t('auth.wakingUpHint')}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.username')}</label>
            <input
              type="text"
              name="username"
              className="form-input"
              placeholder={t('auth.usernamePlaceholder')}
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              name="password"
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

        <div className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="auth-link">{t('auth.registerHere')}</Link>
        </div>
        <Link to="/map" className="auth-guest">{t('auth.backToMap')}</Link>
      </div>
    </div>
  );
}
