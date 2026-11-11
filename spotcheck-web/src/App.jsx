import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Lazy loading de páginas para dividir el бандл (Code Splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));

// Fallback sin destello blanco con el fondo oscuro de la app
const PageFallback = () => (
  <div style={{ minHeight: '100dvh', backgroundColor: '#1c1c1c' }} />
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;