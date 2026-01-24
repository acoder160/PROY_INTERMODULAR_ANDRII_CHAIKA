import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axiosConfig'; // Usamos nuestra configuración de Axios
import '../Auth.css'; // Reutilizamos el estilo oscuro

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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

    try {
      // Llamada al endpoint de registro que creamos en el Backend
      await api.post('/auth/register', formData);
      
      // Si funciona, redirigimos al login para que entre con su cuenta nueva
      alert('¡Cuenta creada con éxito! Ahora inicia sesión.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      // Intentamos mostrar el mensaje de error del backend, o uno genérico
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Error al registrarse. Puede que el usuario ya exista.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Únete al Crew</h1>
        <p className="auth-subtitle">Crea tu cuenta en SkateMap</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Campo Usuario */}
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

          {/* Campo Email (Nuevo respecto al Login) */}
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

          {/* Campo Contraseña */}
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
              minLength={6} // Validación básica de longitud
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