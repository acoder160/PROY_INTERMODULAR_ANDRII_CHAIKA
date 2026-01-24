import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../Auth.css'; // Importamos el diseño que acabamos de crear

export default function LoginPage() {
  // 1. Estados para guardar lo que escribe el usuario
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Hooks de navegación y contexto
  const navigate = useNavigate();
  const { login } = useAuth();

  // 2. Función que se ejecuta al escribir en los inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 3. Función que se ejecuta al pulsar "Entrar"
  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    setError('');
    setIsLoading(true);

    try {
      // Llamamos a la función login del AuthContext
      await login(formData.username, formData.password);
      
      // Si todo va bien, redirigimos al mapa
      navigate('/map');
    } catch (err) {
      // Si falla, mostramos mensaje (asumiendo que el backend devuelve un mensaje de error)
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Título y Logo */}
        <h1 className="auth-title">🛹 SkateMap</h1>
        <p className="auth-subtitle">Encuentra los mejores spots de la ciudad</p>

        {/* Mensaje de Error (si existe) */}
        {error && <div className="error-message">{error}</div>}

        {/* Formulario */}
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