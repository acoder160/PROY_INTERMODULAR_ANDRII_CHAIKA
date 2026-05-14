import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axiosConfig'; 
import '../Auth.css'; 

export default function RegisterPage() {
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
      alert('¡Cuenta creada con éxito! Ahora inicia sesión.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Error al registrarse. Puede que el usuario ya exista.');
      }
    } finally {
      clearTimeout(wakeUpTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Únete al Crew</h1>
        <p className="auth-subtitle">Crea tu cuenta en SkateMap</p>

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
            <label className="form-label">Nombre de Usuario</label>
            <input
              type="text"
              name="username"
              className="form-input"
              placeholder="Ej: tonyhawk99"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="tu@email.com"
              value={formData.email}
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
              placeholder="Elige una segura"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6} 
            />
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="auth-link">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}