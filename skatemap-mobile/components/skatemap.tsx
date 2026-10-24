import React, { useRef, useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet, View, Linking, Image, Dimensions } from 'react-native';
import { CARTO_API_KEY } from '../constants/api';

function serializeForInlineScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Props del mapa
interface SkateMapProps {
  spots?: any[];
  userLocation?: { lat: number, lng: number } | null;
  isAddingMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
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
  const mapReadyRef = useRef(false);
  const windowHeight = Dimensions.get('window').height;

  const ICONS = {
    STREET: Image.resolveAssetSource(require('../assets/images/icon_street.png')).uri,
    PARK: Image.resolveAssetSource(require('../assets/images/icon_park.png')).uri,
    SKATEPARK: Image.resolveAssetSource(require('../assets/images/icon_park.png')).uri,
    RAMPS: Image.resolveAssetSource(require('../assets/images/icon_ramps.png')).uri,
    RAIL: Image.resolveAssetSource(require('../assets/images/icon_rail.png')).uri,
    LEDGE: Image.resolveAssetSource(require('../assets/images/icon_ledge.png')).uri,
  };

  // Sincronizar spots
  useEffect(() => {
    if (mapReadyRef.current && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if(typeof window.renderSpots === 'function') {
          window.renderSpots(${serializeForInlineScript(spots)});
        }
        true;
      `);
    }
  }, [spots]);

  // Sincronizamos la ubicación del usuario
  useEffect(() => {
    if (mapReadyRef.current && userLocation && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if(typeof window.updateUserLocation === 'function') {
          window.updateUserLocation(${userLocation.lat}, ${userLocation.lng});
        }
        true;
      `);
    }
  }, [userLocation]);

  // Sincronizamos el modo "Añadir Spot"
  useEffect(() => {
    if (mapReadyRef.current && webviewRef.current) {
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

  const [staticHtml] = useState(`
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
          html, body { padding: 0; margin: 0; height: 100vh; min-height: 1px; width: 100%; background-color: #e5e5e5; }
          #map { height: 100vh; min-height: 1px; width: 100%; }
          
          .blue-dot { display: flex; justify-content: center; align-items: center; }
          .blue-dot-inner {
            background-color: #007AFF; 
            width: 18px; height: 18px; 
            border-radius: 50%; 
            border: 3px solid white; 
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
          }

          .leaflet-popup-content-wrapper { border-radius: 12px; overflow: hidden; padding: 0; }
          .leaflet-popup-content { margin: 0; }
          .popup-card { width: 220px; font-family: sans-serif; }
          .popup-image { width: 100%; height: 120px; object-fit: cover; background-color: #ddd; }
          .popup-info { padding: 12px; }
          .popup-title { margin: 0 0 6px 0; font-size: 16px; color: #1a1a1a; font-weight: bold; }
          .popup-badges { margin-bottom: 8px; display: flex; gap: 6px; }
          .badge-type { background: #2EC4B6; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          .badge-diff { background: #FF9F1C; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          
          .popup-desc { margin: 0 0 10px 0; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .popup-rating { display: flex; align-items: center; margin-bottom: 8px; }
          .star-icon { color: #FFD700; font-size: 14px; letter-spacing: 2px; }
          
          .btn-container { display: flex; gap: 8px; margin-top: 10px; }
          .btn-container { gap: 8px; margin-top: 12px; }
          .details-btn, .directions-btn {
            flex: 1;
            border: none;
            padding: 10px 8px;
            border-radius: 12px;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 0.4px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.12s ease, box-shadow 0.12s ease;
          }
          .details-btn:active, .directions-btn:active { transform: scale(0.96); }
          .details-btn {
            color: #FFFFFF;
            background: linear-gradient(135deg, #2EC4B6 0%, #168AAD 55%, #105A68 100%);
            box-shadow: 0 4px 10px rgba(22, 138, 173, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
          }
          .directions-btn {
            color: #7EE8EC;
            background: linear-gradient(135deg, #2A3442 0%, #161D28 100%);
            border: 1px solid rgba(126, 232, 236, 0.45);
            box-shadow: 0 4px 10px rgba(10, 20, 30, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          }
          .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
            background: transparent !important;
            border: 0 !important;
          }
          .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
            width: 42px !important;
            height: 42px !important;
            margin-left: 0 !important;
            margin-top: 0 !important;
            display: flex !important;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            border-radius: 50%;
            background: linear-gradient(135deg, #2EC4B6, #168AAD);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
            color: white;
            font-size: 14px;
            font-weight: 800;
            line-height: 1 !important;
          }
          .spot-cluster-label {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.isAddingMode = false;
          window.newSpotMarker = null;

          if (typeof L === 'undefined') {
            throw new Error('Leaflet is unavailable');
          }

          var map = L.map('map', { zoomControl: false }).setView([42.8125, -1.6458], 14);

          var tileUrl = ${CARTO_API_KEY
            ? `'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_API_KEY)}'`
            : "'https://tile.openstreetmap.org/{z}/{x}/{y}.png'"};
            
          L.tileLayer(tileUrl, {
            maxZoom: 19,
            maxNativeZoom: 18, // a zoom máximo se escala el tile en vez de pedir otros nuevos (menos carga)
            subdomains: 'abcd',
            // Carga fluida: cargar tiles mientras se mueve (en móvil por defecto espera a que pare)
            // y mantener una franja amplia de tiles alrededor de la pantalla
            updateWhenIdle: false,
            updateWhenZooming: false,
            updateInterval: 100,
            keepBuffer: 3,
            attribution: ${CARTO_API_KEY
              ? "'© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors © <a href=\"https://carto.com/attributions\">CARTO</a>'"
              : "'© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'"}
          }).addTo(map);

          // Зум, начиная с которого кружки +1 превращаются в настоящие иконки спотов
          var ICON_ZOOM_THRESHOLD = 15;

          var individualSpotsLayer = L.layerGroup();
          var clusteredSpotsLayer = L.markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 25,
            maxClusterRadius: 40,
            disableClusteringAtZoom: ICON_ZOOM_THRESHOLD,
            singleMarkerMode: false, // Управляем иконкой +1 вручную в createSpotMarker, чтобы на зуме >= 15 были картинки
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
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
          var allSpotsData = [];

          var SPOT_ICONS = ${JSON.stringify(ICONS)};
          var spotIcons = {};
          var singleSpotClusterIcon = L.divIcon({
            html: '<div class="spot-cluster-label">+1</div>',
            className: 'marker-cluster marker-cluster-small',
            iconSize: L.point(42, 42)
          });

          function escapeHtml(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
              return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
              }[character];
            });
          }

          function getSpotIcon(spotType, iconUrl) {
            if (!spotIcons[spotType]) {
              spotIcons[spotType] = L.icon({
                iconUrl: iconUrl,
                iconSize: [45, 45],
                iconAnchor: [22, 45],
                popupAnchor: [0, -40]
              });
            }
            return spotIcons[spotType];
          }

          function createSpotMarker(spot, showAsPlusOneBubble, lngOffset) {
            if(spot.latitude === null || spot.latitude === undefined ||
               spot.longitude === null || spot.longitude === undefined) {
              return null;
            }
                
            var spotType = (spot.spotType || spot.type || 'STREET').toUpperCase();
            var iconUrl = SPOT_ICONS[spotType] || SPOT_ICONS['STREET'];
            var icon = getSpotIcon(spotType, iconUrl);

            var imageUrl = spot.mediaUrl ? escapeHtml(spot.mediaUrl) : 'https://via.placeholder.com/220x120?text=Sin+Imagen';
            var diff = (spot.difficultyLevel || 'MEDIA').toUpperCase();
                
            var rating = spot.surfaceRating || 0;
            var fullStars = '★'.repeat(Math.round(rating));
            var emptyStars = '☆'.repeat(5 - Math.round(rating));
                
            // El HTML del popup se construye solo al abrirlo (no para cada marcador en cada movimiento)
            var buildPopup = function() { return \`
              <div class="popup-card">
                <img src="\${imageUrl}" class="popup-image" onerror="this.src='https://via.placeholder.com/220x120?text=Sin+Imagen'" />
                <div class="popup-info">
                  <h3 class="popup-title">\${escapeHtml(spot.name || 'Spot Sin Nombre')}</h3>
                  <div class="popup-rating">
                    <span class="star-icon">\${fullStars}\${emptyStars}</span>
                    <span style="font-size: 11px; color: #666; margin-left: 4px;">(\${rating.toFixed(1)})</span>
                  </div>
                  <div class="popup-badges">
                    <span class="badge-type">\${escapeHtml(spotType)}</span>
                    <span class="badge-diff">\${escapeHtml(diff)}</span>
                  </div>
                  <p class="popup-desc">\${escapeHtml(spot.description || 'No hay descripción detallada para este spot.')}</p>
                  <div class="btn-container">
                    <button class="details-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openDetails', spotId: \${Number(spot.id) || 0} }))">💬 Valorar</button>
                    <button class="directions-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openDirections', lat: \${Number(spot.latitude)}, lng: \${Number(spot.longitude)} }))">🗺️ Ruta</button>
                  </div>
                </div>
              </div>
            \`; };

            return L.marker([spot.latitude, spot.longitude + (lngOffset || 0)], {
              icon: showAsPlusOneBubble ? singleSpotClusterIcon : icon
            }).bindPopup(buildPopup);
          }

          function renderVisibleSpots() {
            individualSpotsLayer.clearLayers();
            clusteredSpotsLayer.clearLayers();
            var bounds = map.getBounds();
            var currentZoom = map.getZoom();

            // El mundo se repite horizontalmente: dibujamos cada spot en todas las copias visibles
            var west = bounds.getWest();
            var east = bounds.getEast();
            var south = bounds.getSouth();
            var north = bounds.getNorth();
            var visibleSpots = [];
            allSpotsData.forEach(function(spot) {
              if (spot.latitude === null || spot.latitude === undefined ||
                  spot.longitude === null || spot.longitude === undefined) {
                return;
              }
              if (spot.latitude < south || spot.latitude > north) {
                return;
              }
              var firstCopy = Math.ceil((west - spot.longitude) / 360);
              var lastCopy = Math.floor((east - spot.longitude) / 360);
              for (var copy = firstCopy; copy <= lastCopy; copy++) {
                visibleSpots.push({ spot: spot, offset: copy * 360 });
              }
            });

            // 1. Главный приоритет: если на экране < 50 спотов — всегда показываем иконки
            // 2. Если >= 50 спотов и зум ниже порога — группируем в кластеры и одиночные прячем в +1
            var useClusterLayer = visibleSpots.length >= 50 && currentZoom < ICON_ZOOM_THRESHOLD;
            var showSingleAsBubble = useClusterLayer;

            var targetLayer = useClusterLayer
              ? clusteredSpotsLayer
              : individualSpotsLayer;

            var markers = visibleSpots.map(function(item) {
              return createSpotMarker(item.spot, showSingleAsBubble, item.offset);
            }).filter(function(marker) {
              return marker !== null;
            });

            if (map.hasLayer(individualSpotsLayer)) {
              map.removeLayer(individualSpotsLayer);
            }
            if (map.hasLayer(clusteredSpotsLayer)) {
              map.removeLayer(clusteredSpotsLayer);
            }
            if (targetLayer.addLayers) {
              targetLayer.addLayers(markers);
            } else {
              markers.forEach(function(marker) {
                targetLayer.addLayer(marker);
              });
            }
            targetLayer.addTo(map);
          }

          window.renderSpots = function(spotsData) {
            allSpotsData = spotsData || [];
            renderVisibleSpots();
          };

          var renderTimer = null;
          map.on('moveend zoomend', function() {
            clearTimeout(renderTimer);
            renderTimer = setTimeout(renderVisibleSpots, 120);
          });
          window.renderVisibleSpots = renderVisibleSpots;

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

            locationCircle = L.circle([lat, lng], {
                color: '#3498db',
                fillColor: '#3498db',
                fillOpacity: 0.15,
                radius: 200,
                weight: 1
            }).addTo(map);

            map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
          };

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
                lat: e.latlng.wrap().lat, 
                lng: e.latlng.wrap().lng 
              }));
            }
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        </script>
      </body>
    </html>
  `);

  return (
    <View style={styles.container}>
      <WebView 
        ref={webviewRef}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        source={{ html: staticHtml }} 
        style={[styles.map, { height: windowHeight }]} 
        scrollEnabled={false}
        bounces={false}
        onLoadEnd={() => {
          mapReadyRef.current = true;
          webviewRef.current?.injectJavaScript(`
            if (typeof map !== 'undefined') {
              document.documentElement.style.height = window.innerHeight + 'px';
              document.body.style.height = window.innerHeight + 'px';
              document.getElementById('map').style.height = window.innerHeight + 'px';
              map.invalidateSize(true);
              window.renderSpots(${serializeForInlineScript(spots)});
              ${userLocation ? `window.updateUserLocation(${userLocation.lat},${userLocation.lng});` : ''}
              window.isAddingMode = ${isAddingMode};
            }
            true;
          `);
        }}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          webviewRef.current?.injectJavaScript(`
            if (typeof map !== 'undefined') {
              document.documentElement.style.height = '${height}px';
              document.body.style.height = '${height}px';
              document.getElementById('map').style.height = '${height}px';
              map.invalidateSize(true);
            }
            true;
          `);
        }}
        onMessage={(event) => {
          let data;
          try {
            data = JSON.parse(event.nativeEvent.data);
          } catch {
            return;
          }
          if (!data || typeof data.type !== 'string') return;
            
          if (data.type === 'mapReady') {
            mapReadyRef.current = true;
          } else if (data.type === 'error') {
             alert(data.message);
          } 
          else if (data.type === 'locationSelected' &&
            Number.isFinite(data.lat) && Number.isFinite(data.lng) &&
            Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180 && onMapClick) {
             onMapClick(data.lat, data.lng);
          }
          else if (data.type === 'openDetails' &&
            Number.isSafeInteger(data.spotId) && data.spotId > 0 && onSpotClick) {
             onSpotClick(data.spotId);
          }
          else if (data.type === 'openDirections' &&
            Number.isFinite(data.lat) && Number.isFinite(data.lng) &&
            Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180) {
             const url = `https://maps.google.com/?q=${data.lat},${data.lng}`;
             Linking.openURL(url).catch(err => console.error("No se pudo abrir Maps", err));
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e5e5' },
  map: { width: '100%', flex: 1 },
});