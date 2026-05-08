import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Definimos las propiedades que acepta el mapa
interface SkateMapProps {
  spots?: any[];
  userLocation?: { lat: number, lng: number } | null;
  isAddingMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function SkateMap({ 
  spots = [], 
  userLocation,
  isAddingMode = false,
  onMapClick 
}: SkateMapProps) {
  const webviewRef = useRef<WebView>(null);

  // 1. Sincronizamos la ubicación del usuario
  useEffect(() => {
    if (userLocation && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if(typeof window.updateUserLocation === 'function') {
          window.updateUserLocation(${userLocation.lat}, ${userLocation.lng});
        }
        true;
      `);
    }
  }, [userLocation]);

  // 2. Sincronizamos el modo "Añadir Spot" para que el mapa deje hacer clic
  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        window.isAddingMode = ${isAddingMode};
        if (!${isAddingMode} && window.newSpotMarker) {
          map.removeLayer(window.newSpotMarker);
          window.newSpotMarker = null;
        }
        true;
      `);
    }
  }, [isAddingMode]);

  const spotsJSON = JSON.stringify(spots);

  const leafletHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { padding: 0; margin: 0; height: 100%; width: 100%; background-color: #e5e5e5; }
          #map { height: 100%; width: 100%; }
          
          /* Emojis flotantes con sombra */
          .custom-marker {
            font-size: 30px; 
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4)); 
            display: flex; 
            justify-content: center; 
            align-items: center;
          }

          /* Diseño del Punto Azul de Ubicación */
          .blue-dot { display: flex; justify-content: center; align-items: center; }
          .blue-dot-inner {
            background-color: #007AFF; 
            width: 18px; height: 18px; 
            border-radius: 50%; 
            border: 3px solid white; 
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
          }

          /* DISEÑO DEL POPUP (Igual a tu versión Web) */
          .leaflet-popup-content-wrapper { border-radius: 12px; overflow: hidden; padding: 0; }
          .leaflet-popup-content { margin: 0; }
          .popup-card { width: 220px; font-family: sans-serif; }
          .popup-image { width: 100%; height: 120px; object-fit: cover; background-color: #ddd; }
          .popup-info { padding: 12px; }
          .popup-title { margin: 0 0 6px 0; font-size: 16px; color: #1a1a1a; font-weight: bold; }
          .popup-badges { margin-bottom: 8px; display: flex; gap: 6px; }
          .badge-type { background: #2EC4B6; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          .badge-diff { background: #FF9F1C; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          .popup-desc { margin: 0; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.isAddingMode = ${isAddingMode};
          window.newSpotMarker = null;

          var map = L.map('map', { zoomControl: false }).setView([42.8125, -1.6458], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // 1. LOS IFS PARA LOS ICONOS (Corregidos según tu versión web)
          function getSpotEmoji(type) {
            var t = (type || '').toUpperCase();
            switch (t) {
              case 'STREET': return '🛹';
              case 'PARK':   return '🏟️';
              case 'SKATEPARK': return '🏟️';
              case 'RAMPS':  return '🏂';
              case 'RAIL':   return '🥖';
              case 'LEDGE':  return '🧱';
              default:       return '📍';
            }
          }

          var spotsData = ${spotsJSON};

          spotsData.forEach(function(spot) {
            if(spot.latitude && spot.longitude) {
              
              var emoji = getSpotEmoji(spot.spotType || spot.type);
              var icon = L.divIcon({
                className: 'custom-marker',
                html: emoji,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -25]
              });

              var imageUrl = spot.mediaUrl ? spot.mediaUrl : 'https://skateism.com/wp-content/uploads/2019/02/placeholder-skate.jpg';
              var spotType = (spot.spotType || 'SPOT').toUpperCase();
              var diff = (spot.difficultyLevel || 'MEDIA').toUpperCase();
              
              var popupHTML = \`
                <div class="popup-card">
                  <img src="\${imageUrl}" class="popup-image" onerror="this.src='https://via.placeholder.com/220x120?text=Sin+Imagen'" />
                  <div class="popup-info">
                    <h3 class="popup-title">\${spot.name || 'Spot Sin Nombre'}</h3>
                    <div class="popup-badges">
                      <span class="badge-type">\${spotType}</span>
                      <span class="badge-diff">\${diff}</span>
                    </div>
                    <p class="popup-desc">\${spot.description || 'No hay descripción detallada para este spot.'}</p>
                  </div>
                </div>
              \`;

              L.marker([spot.latitude, spot.longitude], { icon: icon })
                .addTo(map)
                .bindPopup(popupHTML);
            }
          });

          // 2. FUNCIÓN PARA EL BOTÓN DEL PUNTO AZUL
          var userMarker = null;
          window.updateUserLocation = function(lat, lng) {
            if (userMarker) {
              map.removeLayer(userMarker);
            }
            var blueDotIcon = L.divIcon({
              className: 'blue-dot',
              html: '<div class="blue-dot-inner"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            
            userMarker = L.marker([lat, lng], { icon: blueDotIcon }).addTo(map);
            map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
          };

          // 3. EVENTO DE CLIC EN EL MAPA (CRÍTICO PARA PODER AÑADIR SPOTS)
          map.on('click', function(e) {
            if (window.isAddingMode) {
              if (window.newSpotMarker) {
                map.removeLayer(window.newSpotMarker);
              }
              // Ponemos un pin temporal donde el usuario tocó
              window.newSpotMarker = L.marker(e.latlng, { opacity: 0.7 }).addTo(map);
              
              // Enviamos las coordenadas a la app móvil
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                lat: e.latlng.lat, 
                lng: e.latlng.lng 
              }));
            }
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView 
        ref={webviewRef}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        source={{ html: leafletHTML }} 
        style={styles.map} 
        scrollEnabled={false}
        bounces={false}
        // 4. RECIBIMOS LAS COORDENADAS AQUÍ CUANDO SE TOCA EL MAPA
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.lat && data.lng && onMapClick) {
              onMapClick(data.lat, data.lng);
            }
          } catch (e) {
            console.error("Error leyendo mensaje del WebView:", e);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e5e5' },
  map: { flex: 1 },
});