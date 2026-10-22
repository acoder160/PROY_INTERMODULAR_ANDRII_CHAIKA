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
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
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
          .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
            background: transparent !important;
            border: 0 !important;
          }
          .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
            width: 42px !important; height: 42px !important; margin: 0 !important;
            display: flex !important; align-items: center; justify-content: center;
            border: 3px solid white; border-radius: 50%;
            background: linear-gradient(135deg, #2EC4B6, #168AAD);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
            color: white; font-size: 14px; font-weight: 800; line-height: 1 !important;
          }
          .spot-cluster-label { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
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
          var individualSpotsLayer = L.layerGroup();
          var clusteredSpotsLayer = L.markerClusterGroup({
            maxClusterRadius: 40,
            disableClusteringAtZoom: 13,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function(cluster) {
              var count = cluster.getChildCount();
              var size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
              return L.divIcon({
                html: '<div class="spot-cluster-label">+' + count + '</div>',
                className: 'marker-cluster marker-cluster-' + size,
                iconSize: L.point(42, 42)
              });
            }
          });

          function createSpotMarker(spot) {
            if (spot.latitude === null || spot.latitude === undefined ||
                spot.longitude === null || spot.longitude === undefined) {
              return null;
            }
            return L.marker([spot.latitude, spot.longitude], { icon: emojiIcon })
              .bindPopup('<b style="font-size:16px;">' + (spot.name || 'Spot') + '</b><br>' + (spot.description || ''));
          }

          function renderVisibleSpots() {
            individualSpotsLayer.clearLayers();
            clusteredSpotsLayer.clearLayers();
            var bounds = map.getBounds();
            var visibleSpots = spotsData.filter(function(spot) {
              return spot.latitude !== null && spot.latitude !== undefined &&
                spot.longitude !== null && spot.longitude !== undefined &&
                bounds.contains([spot.latitude, spot.longitude]);
            });
            var targetLayer = visibleSpots.length < 50 ? individualSpotsLayer : clusteredSpotsLayer;
            var markers = visibleSpots.map(createSpotMarker).filter(function(marker) {
              return marker !== null;
            });
            if (map.hasLayer(individualSpotsLayer)) map.removeLayer(individualSpotsLayer);
            if (map.hasLayer(clusteredSpotsLayer)) map.removeLayer(clusteredSpotsLayer);
            if (targetLayer.addLayers) {
              targetLayer.addLayers(markers);
            } else {
              markers.forEach(function(marker) { targetLayer.addLayer(marker); });
            }
            targetLayer.addTo(map);
          }

          map.on('moveend zoomend', renderVisibleSpots);
          renderVisibleSpots();

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