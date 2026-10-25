import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import LanguageSwitcher from '../components/LanguageSwitcher';
import '../Auth.css';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

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
      alert(t('auth.accountCreated'));
      navigate('/login');
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
        <p className="auth-eyebrow">SKATEMAP / JOIN THE RIDE</p>
        <h1 className="auth-title">{t('auth.joinCrew')}</h1>
        <p className="auth-subtitle">{t('auth.createAccountSubtitle')}</p>

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
              placeholder={t('auth.registerUsernamePlaceholder')}
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
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
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? t('auth.registering') : t('auth.createAccount')}
          </button>
        </form>

        <div className="auth-footer">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="auth-link">{t('auth.loginLink')}</Link>
        </div>
        <Link to="/map" className="auth-guest">{t('auth.backToMap')}</Link>
      </div>
    </div>
  );
}
