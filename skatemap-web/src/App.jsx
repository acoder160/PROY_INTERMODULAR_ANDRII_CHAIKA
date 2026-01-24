import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importamos las páginas que creaste antes
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';

// Componente para proteger rutas (El "Portero de Discoteca")
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

          {/* Si te pierdes, vas al mapa (o al login si no estás auth) */}
          <Route path="*" element={<Navigate to="/map" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;