import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importamos las páginas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';

// Componente para proteger rutas
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  // Si no hay usuario, te manda al Login. Si hay, te deja pasar.
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Ruta Protegida (Solo skaters logueados) */}
          <Route 
            path="/map" 
            element={
              <PrivateRoute>
                <MapPage />
              </PrivateRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/map" />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;