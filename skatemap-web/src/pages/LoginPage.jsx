import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../Auth.css'; 

export default function LoginPage() {
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
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
    } finally {
      clearTimeout(wakeUpTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">🛹 SkateMap</h1>
        <p className="auth-subtitle">Encuentra los mejores spots de la ciudad</p>

        {/* Mensaje de Error */}
        {error && !isLoading && <div className="error-message">{error}</div>}

        {isWakingUp && (
          <div className="loading-message">
            <div className="spinner"></div> 
            <p className="loading-text">Levantando el servidor...</p>
            <p className="loading-subtext">(suele tardar entre 1 y 2 minutos)</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              name="username"
              className="form-input"
              placeholder="Ej: skater123"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
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
            {isLoading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-footer">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="auth-link">Regístrate aquí</Link>
        </div>
      </div>
    </div>
  );
}