import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function SkateMap({ spots = [] }: { spots?: any[] }) {
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
          var map = L.map('map', {
            zoomControl: false 
          }).setView([42.8125, -1.6458], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          var emojiIcon = L.divIcon({
            className: 'custom-marker',
            html: '📍',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -25]
          });

          var spotsData = ${spotsJSON};

          spotsData.forEach(function(spot) {
            if(spot.latitude && spot.longitude) {
              L.marker([spot.latitude, spot.longitude], { icon: emojiIcon })
                .addTo(map)
                .bindPopup('<b style="font-size:16px;">' + (spot.name || 'Spot') + '</b><br>' + (spot.description || ''));
            }
          });

          if (spotsData.length === 0) {
            L.marker([42.8125, -1.6458], { icon: emojiIcon })
              .addTo(map)
              .bindPopup('<b style="font-size:16px;">Pamplona</b><br>¡Añade tu primer spot!');
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <iframe 
        srcDoc={leafletHTML}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="SkateMap Web"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5e5e5',
  },
});