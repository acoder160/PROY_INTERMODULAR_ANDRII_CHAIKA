import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Definimos las propiedades que acepta el mapa
interface SkateMapProps {
  spots?: any[];
  userLocation?: { lat: number, lng: number } | null;
  isAddingMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  // 🟢 NUEVO: Callback para cuando se hace clic en un spot existente
  onSpotClick?: (spotId: number) => void; 
}

export default function SkateMap({ 
  spots = [], 
  userLocation,
  isAddingMode = false,
  onMapClick,
  onSpotClick
}: SkateMapProps) {
  const webviewRef = useRef<WebView>(null);

  // --- 1. Sincronizamos los spots sin recargar el mapa ---
  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if(typeof window.renderSpots === 'function') {
          window.renderSpots(${JSON.stringify(spots)});
        }
        true;
      `);
    }
  }, [spots]);

  // 2. Sincronizamos la ubicación del usuario
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

  // 3. Sincronizamos el modo "Añadir Spot" para que el mapa deje hacer clic
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

  // --- 4. CLAVE: Usamos useState para que el HTML sea estático ---
  const [staticHtml] = useState(`
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

          /* DISEÑO DEL POPUP */
          .leaflet-popup-content-wrapper { border-radius: 12px; overflow: hidden; padding: 0; }
          .leaflet-popup-content { margin: 0; }
          .popup-card { width: 220px; font-family: sans-serif; }
          .popup-image { width: 100%; height: 120px; object-fit: cover; background-color: #ddd; }
          .popup-info { padding: 12px; }
          .popup-title { margin: 0 0 6px 0; font-size: 16px; color: #1a1a1a; font-weight: bold; }
          .popup-badges { margin-bottom: 8px; display: flex; gap: 6px; }
          .badge-type { background: #2EC4B6; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          .badge-diff { background: #FF9F1C; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          
          /* 🟢 NUEVOS ESTILOS: Descripción más corta, estrellas y botón */
          .popup-desc { margin: 0 0 10px 0; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .popup-rating { display: flex; align-items: center; margin-bottom: 8px; }
          .star-icon { color: #FFD700; font-size: 14px; letter-spacing: 2px; }
          .details-btn { background: #007AFF; color: white; border: none; padding: 8px; width: 100%; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Inicializamos los estados
          window.isAddingMode = false;
          window.newSpotMarker = null;

          var map = L.map('map', { zoomControl: false }).setView([42.8125, -1.6458], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Creamos una capa para los spots para poder borrarlos y redibujarlos dinámicamente
          var spotsLayer = L.layerGroup().addTo(map);

          // 1. LOS IFS PARA LOS ICONOS
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

          // FUNCIÓN PARA RENDERIZAR SPOTS DINÁMICAMENTE
          window.renderSpots = function(spotsData) {
            spotsLayer.clearLayers(); 
            
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
                
                // LÓGICA DE ESTRELLAS
                var rating = spot.surfaceRating || 0;
                var fullStars = '★'.repeat(Math.round(rating));
                var emptyStars = '☆'.repeat(5 - Math.round(rating));
                
                var popupHTML = \`
                  <div class="popup-card">
                    <img src="\${imageUrl}" class="popup-image" onerror="this.src='https://via.placeholder.com/220x120?text=Sin+Imagen'" />
                    <div class="popup-info">
                      <h3 class="popup-title">\${spot.name || 'Spot Sin Nombre'}</h3>
                      
                      <div class="popup-rating">
                        <span class="star-icon">\${fullStars}\${emptyStars}</span>
                        <span style="font-size: 11px; color: #666; margin-left: 4px;">(\${rating.toFixed(1)})</span>
                      </div>

                      <div class="popup-badges">
                        <span class="badge-type">\${spotType}</span>
                        <span class="badge-diff">\${diff}</span>
                      </div>
                      
                      <p class="popup-desc">\${spot.description || 'No hay descripción detallada para este spot.'}</p>
                      
                      <button class="details-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openDetails', spotId: \${spot.id} }))">
                        Ver y Valorar 💬
                      </button>
                    </div>
                  </div>
                \`;

                L.marker([spot.latitude, spot.longitude], { icon: icon })
                  .addTo(spotsLayer) // Añadimos a la capa nueva
                  .bindPopup(popupHTML);
              }
            });
          };

          // 2. FUNCIÓN PARA EL BOTÓN DEL PUNTO AZUL Y CÍRCULO
          var userMarker = null;
          var locationCircle = null; 

          window.updateUserLocation = function(lat, lng) {
            if (userMarker) map.removeLayer(userMarker);
            if (locationCircle) map.removeLayer(locationCircle);

            var blueDotIcon = L.divIcon({
              className: 'blue-dot',
              html: '<div class="blue-dot-inner"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            
            userMarker = L.marker([lat, lng], { icon: blueDotIcon }).addTo(map);

            // DIBUJAMOS EL RADIO DE 200 METROS
            locationCircle = L.circle([lat, lng], {
                color: '#3498db',
                fillColor: '#3498db',
                fillOpacity: 0.15,
                radius: 200, // 200 metros
                weight: 1
            }).addTo(map);

            map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
          };

          // 3. EVENTO DE CLIC EN EL MAPA CON VALIDACIÓN DE 200m
          map.on('click', function(e) {
            if (window.isAddingMode) {
              
              if (!userMarker) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'error', 
                    message: 'Por favor, espera a que el GPS detecte tu ubicación.' 
                 }));
                 return;
              }

              var userLatLng = userMarker.getLatLng();
              var distanceInMeters = userLatLng.distanceTo(e.latlng);

              if (distanceInMeters > 200) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'error', 
                    message: 'Estás a ' + Math.round(distanceInMeters) + 'm. Debes estar a menos de 200m del spot para añadirlo.' 
                 }));
                 return;
              }

              if (window.newSpotMarker) {
                map.removeLayer(window.newSpotMarker);
              }
              window.newSpotMarker = L.marker(e.latlng, { opacity: 0.7 }).addTo(map);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'locationSelected', 
                lat: e.latlng.lat, 
                lng: e.latlng.lng 
              }));
            }
          });
        </script>
      </body>
    </html>
  `);

  return (
    <View style={styles.container}>
      <WebView 
        ref={webviewRef}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        source={{ html: staticHtml }} // Usamos la constante estática
        style={styles.map} 
        scrollEnabled={false}
        bounces={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            
            if (data.type === 'error') {
               alert(data.message);
            } 
            else if (data.type === 'locationSelected' && data.lat && data.lng && onMapClick) {
               onMapClick(data.lat, data.lng);
            }
            // Escuchamos el clic del botón de detalles
            else if (data.type === 'openDetails' && onSpotClick) {
               onSpotClick(data.spotId);
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