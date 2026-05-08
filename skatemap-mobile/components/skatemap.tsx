import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function SkateMap() {
  // Trasladamos diseño exacto de Leaflet y CartoDB de la Web a la App Móvil
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          /* Aseguramos que ocupe el 100% de la pantalla */
          html, body { padding: 0; margin: 0; height: 100%; width: 100%; background-color: #e5e5e5; }
          #map { height: 100%; width: 100%; }
          
          /* Tus clases CSS de la web para los emojis */
          .custom-marker {
            font-size: 30px; 
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); 
            display: flex; 
            justify-content: center; 
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Coordenadas de Pamplona
          var map = L.map('map', {
            zoomControl: false 
          }).setView([42.8125, -1.6458], 14);

          // Tu mapa base de CartoDB Voyager
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Tu icono personalizado con el emoji
          var emojiIcon = L.divIcon({
            className: 'custom-marker',
            html: '📍',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -25]
          });

          L.marker([42.8125, -1.6458], { icon: emojiIcon })
            .addTo(map)
            .bindPopup('<b style="font-size:16px;">Centro de Pamplona</b><br>¡Tus mapas web en el móvil!')
            .openPopup();
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView 
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        source={{ html: leafletHTML }} 
        style={styles.map} 
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Vital para que la pantalla blanca desaparezca
    backgroundColor: '#e5e5e5',
  },
  map: {
    flex: 1,
  },
});