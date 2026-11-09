import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Importamos las páginas
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import AdminReportsPage from './pages/AdminReportsPage';
import LegalPage from './pages/LegalPage';
import ProfilePage from './pages/ProfilePage';
import SavedPage from './pages/SavedPage';

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
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/legal" element={<LegalPage />} />
          {/* Social: profiles are public; feed, notifications and saved spots ask for an account */}
          <Route path="/u/:username" element={<ProfilePage />} />
          {/* Feed and notifications are windows over the map; the old URLs open them there */}
          <Route path="/feed" element={<Navigate to="/map?panel=feed" replace />} />
          <Route path="/notifications" element={<Navigate to="/map?panel=notifications" replace />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="*" element={<Navigate to="/map" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;