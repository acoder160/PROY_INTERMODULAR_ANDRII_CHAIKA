import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Importamos las páginas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import LegalPage from './pages/LegalPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* El mapa y la consulta de spots son públicos; las interacciones requieren sesión. */}
          <Route path="/map" element={<MapPage />} />

          <Route path="/admin" element={<AdminPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="*" element={<Navigate to="/map" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;