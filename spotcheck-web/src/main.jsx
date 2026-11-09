import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css';
import '@fontsource/big-shoulders-display/700'
import '@fontsource/big-shoulders-display/900'
import './tokens.css'
import './index.css'
// App después de leaflet.css: los estilos propios del mapa deben ganar a los de Leaflet
import App from './App.jsx'
import { i18nReady } from './i18n'

// Esperamos a que cargue el idioma inicial para no mostrar las claves de traducción
i18nReady.finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
