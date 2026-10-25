import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css';
import './index.css'
import { i18nReady } from './i18n'

// Esperamos a que cargue el idioma inicial para no mostrar las claves de traducción
i18nReady.finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
