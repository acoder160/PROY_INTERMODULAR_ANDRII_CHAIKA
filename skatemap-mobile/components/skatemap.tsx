import React, { useRef, useEffect, useState, type ComponentRef } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet, View, Linking, Image, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CARTO_API_KEY } from '../constants/api';
import { Palette, spotTypePaint } from '../constants/theme';
import { cleanLabel } from '../utils/text';


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
  /** Short notice for map-side problems while placing a spot (too far, no GPS). */
  onNotice?: (message: string) => void;
}

export default function SkateMap({ 
  spots = [], 
  userLocation,
  isAddingMode = false,
  onMapClick,
  onSpotClick,
  onNotice = (message: string) => alert(message)
}: SkateMapProps) {
  const { t } = useTranslation();
  const webviewRef = useRef<ComponentRef<typeof WebView>>(null);
  const mapReadyRef = useRef(false);
  const windowHeight = Dimensions.get('window').height;

  const strings = {
    rate: cleanLabel(t('webview.rate')),
    route: cleanLabel(t('webview.route')),
    unnamed: t('webview.unnamed'),
    noDescription: t('webview.noDescription'),
    noImage: t('popup.noImage'),
    types: {
      STREET: t('types.STREET'),
      PARK: t('types.PARK'),
      SKATEPARK: t('types.SKATEPARK'),
      RAMPS: t('types.RAMPS'),
      RAIL: t('types.RAIL'),
      LEDGE: t('types.LEDGE'),
    },
    difficulty: {
      BEGINNER: t('difficulty.BEGINNER'),
      INTERMEDIATE: t('difficulty.INTERMEDIATE'),
      ADVANCED: t('difficulty.ADVANCED'),
    },
  };
  const stringsJson = serializeForInlineScript(strings);

  // Al cambiar el idioma del teléfono, actualizamos los textos del mapa (los popups se crean al abrirlos)
  useEffect(() => {
    if (mapReadyRef.current && webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        window.I18N = ${stringsJson};
        true;
      `);
    }
  }, [stringsJson]);

  // Iconos propios de cada tipo de spot
  const ICONS = {
    STREET: Image.resolveAssetSource(require('../assets/images/icon_street.png'))?.uri ?? '',
    PARK: Image.resolveAssetSource(require('../assets/images/icon_park.png'))?.uri ?? '',
    SKATEPARK: Image.resolveAssetSource(require('../assets/images/icon_park.png'))?.uri ?? '',
    RAMPS: Image.resolveAssetSource(require('../assets/images/icon_ramps.png'))?.uri ?? '',
    RAIL: Image.resolveAssetSource(require('../assets/images/icon_rail.png'))?.uri ?? '',
    LEDGE: Image.resolveAssetSource(require('../assets/images/icon_ledge.png'))?.uri ?? '',
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
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap" />
        <style>
          :root {
            --asphalt: ${Palette.asphalt};
            --concrete: ${Palette.concrete};
            --sheet: ${Palette.sheet};
            --ink-muted: ${Palette.inkMuted};
            --hairline: ${Palette.hairline};
            --pink: ${Palette.pink};
            --display: 'Big Shoulders Display', system-ui, sans-serif;
          }
          html, body { padding: 0; margin: 0; height: 100vh; min-height: 1px; width: 100%; background-color: var(--concrete); }
          #map { height: 100vh; min-height: 1px; width: 100%; background-color: var(--concrete); }
          body { -webkit-tap-highlight-color: transparent; }

          /* Usuario: punto asfalto con anillo blanco y pulso */
          .blue-dot { display: flex; justify-content: center; align-items: center; }
          .blue-dot-inner {
            background-color: var(--asphalt);
            width: 16px; height: 16px;
            border-radius: 50%;
            border: 3px solid var(--sheet);
            box-shadow: 0 2px 3px rgba(0,0,0,0.35);
            position: relative;
          }
          .blue-dot-inner::after {
            content: '';
            position: absolute;
            top: -3px; left: -3px; right: -3px; bottom: -3px;
            border-radius: 50%;
            border: 2px solid var(--asphalt);
            animation: dot-pulse 2.2s ease-out infinite;
          }
          @keyframes dot-pulse {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(2.8); opacity: 0; }
          }
          .user-radius { animation: radius-in 0.6s ease-out; }
          @keyframes radius-in { from { opacity: 0; } to { opacity: 1; } }

          /* Spots: iconos propios por tipo; la marca del spot nuevo usa .paint-marker */
          .paint-marker { display: flex; align-items: center; justify-content: center; }
          .spot-icon { background: transparent; border: 0; }
          .spot-icon-img {
            display: block;
            width: 45px; height: 45px;
            transform-origin: 50% 100%;
            transition: transform 0.12s ease;
          }
          .spot-icon.is-selected .spot-icon-img { transform: scale(1.2); }
          .proposed-dot {
            width: 22px; height: 22px;
            border-radius: 50%;
            background: var(--pink);
            border: 3px dashed var(--asphalt);
          }

          /* Popup: hoja blanca, contorno de tinta */
          .leaflet-popup-content-wrapper {
            border-radius: 16px;
            overflow: hidden;
            padding: 0;
            border: 2px solid var(--asphalt);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .leaflet-popup-tip { background: var(--sheet); border: 2px solid var(--asphalt); box-shadow: none; }
          .leaflet-popup-tip-container { margin-top: -2px; }
          .leaflet-popup-content { margin: 0; }
          .leaflet-container a.leaflet-popup-close-button {
            top: 8px; right: 8px;
            width: 32px; height: 32px;
            border-radius: 50%;
            background: var(--asphalt);
            border: 2px solid var(--sheet);
            color: var(--sheet);
            font: 700 20px/28px system-ui, sans-serif;
            text-align: center;
          }
          .popup-card { width: 240px; font-family: system-ui, Roboto, sans-serif; color: var(--asphalt); }
          .popup-image { display: block; width: 100%; height: 112px; object-fit: cover; background-color: var(--concrete); }
          .popup-image-empty { display: flex; align-items: center; justify-content: center; }
          .popup-info { padding: 12px 14px 14px; }
          .popup-title {
            margin: 0 0 8px 0;
            font: 900 24px/26px var(--display);
            letter-spacing: 0.4px;
            text-transform: uppercase;
            overflow-wrap: anywhere;
          }
          .popup-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
          .type-chip {
            padding: 3px 9px;
            border: 2px solid var(--asphalt);
            border-radius: 10px;
            font: 700 15px/1.1 var(--display);
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--asphalt);
          }
          .diff { display: inline-flex; align-items: center; gap: 6px; font: 700 15px/1 var(--display); letter-spacing: 0.8px; text-transform: uppercase; }
          .diff-marks { display: inline-flex; gap: 3px; }
          .diff-marks i { display: inline-block; width: 6px; height: 14px; background: var(--asphalt); transform: skewX(-18deg); }
          .diff-marks i.off { background: transparent; border: 1.5px solid var(--asphalt); box-sizing: border-box; }
          .popup-rating { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
          .popup-rating svg { display: block; }
          .popup-rating-num { font: 900 18px/1 var(--display); }
          .popup-desc {
            margin: 0;
            font-size: 14px; line-height: 19px;
            color: var(--ink-muted);
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          }

          .btn-container { display: flex; gap: 8px; margin-top: 12px; }
          .details-btn, .directions-btn {
            flex: 1;
            min-height: 48px;
            padding: 6px 8px;
            border: 2px solid var(--asphalt);
            border-radius: 24px;
            font: 900 18px/1 var(--display);
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--asphalt);
            cursor: pointer;
            transition: transform 0.12s ease;
          }
          .details-btn:active, .directions-btn:active { transform: scale(0.96); }
          .details-btn { background: var(--sheet); }
          .directions-btn { background: var(--pink); }

          /* Clusters "+N": asfalto, anillo blanco */
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
            box-sizing: border-box;
            border: 3px solid var(--sheet);
            border-radius: 50%;
            background: var(--asphalt);
            box-shadow: 0 2px 3px rgba(0, 0, 0, 0.35);
            color: var(--sheet);
            font: 900 17px/1 var(--display) !important;
            letter-spacing: 0.4px;
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

          var map = L.map('map', { zoomControl: false, doubleClickZoom: false, zoomSnap: 0, fadeAnimation: false }).setView([41.3874, 2.1686], 14);

          var tileUrl = ${CARTO_API_KEY
            ? `'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_API_KEY)}'`
            : "'https://tile.openstreetmap.org/{z}/{x}/{y}.png'"};

          // PRERENDER: capa de tiles que también carga una franja de N tiles fuera de la pantalla
          // (como PaddedTileLayer en la web), así al alejar o arrastrar ya hay mapa en los bordes.
          var PaddedTileLayer = L.TileLayer.extend({
            _getTiledPixelBounds: function(center) {
              var bounds = L.TileLayer.prototype._getTiledPixelBounds.call(this, center);
              var pad = this.getTileSize().x * (this.options.preloadTiles || 0);
              return L.bounds(bounds.min.subtract([pad, pad]), bounds.max.add([pad, pad]));
            }
          });

          // SUBCAPA de baja resolución: tiles de 2 niveles menos estirados a 1024px. Cada uno cubre
          // 4x más superficie, así que al alejar el borde se rellena al instante (algo borroso) mientras
          // llegan los tiles nítidos encima. Son pocas imágenes pequeñas: casi no gasta datos.
          new PaddedTileLayer(tileUrl, {
            tileSize: 1024,
            zoomOffset: -2,
            minZoom: 2,
            maxZoom: 19,
            maxNativeZoom: 18,
            subdomains: 'abcd',
            preloadTiles: 1,
            keepBuffer: 4,
            updateWhenIdle: false,
            updateWhenZooming: true,
            updateInterval: 100,
            zIndex: 0
          }).addTo(map);

          L.tileLayer(tileUrl, {
            maxZoom: 19,
            maxNativeZoom: 18, // a zoom máximo se escala el tile en vez de pedir otros nuevos (menos carga)
            subdomains: 'abcd',
            // Carga fluida: cargar tiles mientras se mueve (en móvil por defecto espera a que pare)
            // y mantener una franja amplia de tiles alrededor de la pantalla
            updateWhenIdle: false,
            updateWhenZooming: true,
            updateInterval: 100,
            keepBuffer: 3,
            // Sin franja extra aquí: la subcapa ya cubre los bordes al alejar y cuesta la mitad de datos
            zIndex: 1,
            attribution: ${CARTO_API_KEY
              ? "'© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors © <a href=\"https://carto.com/attributions\">CARTO</a>'"
              : "'© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'"}
          }).addTo(map);

          // Зум, начиная с которого кружки +1 превращаются в настоящие иконки спотов
          var ICON_ZOOM_THRESHOLD = 15;

          // ZOOM CON UN DEDO (como Google Maps):
          //  - doble toque: acerca un nivel sobre el punto tocado
          //  - doble toque y arrastrar sin soltar: zoom continuo (hacia abajo acerca, hacia arriba aleja)
          // Usa el mismo mecanismo que el zoom con dos dedos de Leaflet (map._move con pinch + _animateZoom
          // sin recargar tiles): los tiles actuales se escalan y siguen visibles, no aparece el fondo gris.
          (function() {
            var container = map.getContainer();
            var lastTap = { time: 0, x: 0, y: 0 };
            var gesture = null;
            var frame = null;

            // Centro del mapa que mantiene fijo el punto tocado al cambiar el zoom
            function centerFor(g, zoom) {
              var scale = map.getZoomScale(zoom, g.startZoom);
              var half = map.getSize().divideBy(2);
              var offset = g.point.subtract(half).multiplyBy(1 - 1 / scale);
              return map.unproject(map.project(g.startCenter, g.startZoom).add(offset), g.startZoom);
            }

            function clampZoom(zoom) {
              return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
            }

            // Zoom animado y suave, con los tiles actuales escalados
            function animateTo(g, zoom) {
              var center = centerFor(g, zoom);
              if (typeof map._animateZoom === 'function' && typeof map._moveStart === 'function') {
                map._moveStart(true, false);
                map._animateZoom(center, zoom, true, map.options.zoomSnap);
              } else {
                map.setZoomAround(g.point, zoom, { animate: true });
              }
            }

            container.addEventListener('touchstart', function(e) {
              if (e.touches.length !== 1) { lastTap.time = 0; gesture = null; return; }
              // Los toques sobre marcadores, popups o controles no cuentan
              if (e.target.closest && e.target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control')) {
                lastTap.time = 0;
                return;
              }
              var touch = e.touches[0];
              var now = Date.now();
              var isDoubleTap = now - lastTap.time < 300 &&
                Math.abs(touch.clientX - lastTap.x) < 30 &&
                Math.abs(touch.clientY - lastTap.y) < 30;

              if (isDoubleTap) {
                var rect = container.getBoundingClientRect();
                gesture = {
                  startY: touch.clientY,
                  startZoom: map.getZoom(),
                  startCenter: map.getCenter(),
                  point: L.point(touch.clientX - rect.left, touch.clientY - rect.top),
                  zoom: map.getZoom(),
                  center: map.getCenter(),
                  moved: false
                };
                lastTap.time = 0;
                map.dragging.disable();
                e.preventDefault(); // evita el clic sintético (no se coloca un spot por error)
              } else {
                lastTap = { time: now, x: touch.clientX, y: touch.clientY };
              }
            }, { passive: false });

            container.addEventListener('touchmove', function(e) {
              if (!gesture || e.touches.length !== 1) return;
              var dy = e.touches[0].clientY - gesture.startY;
              if (!gesture.moved) {
                if (Math.abs(dy) < 8) return;
                gesture.moved = true;
                if (typeof map._stop === 'function') map._stop();
                if (typeof map._moveStart === 'function') map._moveStart(true, false);
              }
              e.preventDefault();

              var g = gesture;
              g.zoom = clampZoom(g.startZoom + dy / 90);
              g.center = centerFor(g, g.zoom);
              if (frame) cancelAnimationFrame(frame);
              frame = requestAnimationFrame(function() {
                frame = null;
                if (typeof map._move === 'function') {
                  map._move(g.center, g.zoom, { pinch: true, round: false });
                } else {
                  map.setZoomAround(g.point, g.zoom, { animate: false });
                }
              });
            }, { passive: false });

            function endGesture() {
              if (!gesture) return;
              var g = gesture;
              gesture = null;
              if (frame) { cancelAnimationFrame(frame); frame = null; }
              map.dragging.enable();

              if (g.moved) {
                // Termina el gesto igual que el zoom con dos dedos: animación final sin recargar tiles
                if (typeof map._animateZoom === 'function') {
                  map._animateZoom(g.center, g.zoom, true, map.options.zoomSnap);
                } else {
                  map.setZoomAround(g.point, g.zoom, { animate: false });
                }
              } else {
                animateTo(g, clampZoom(Math.round(g.startZoom) + 1));
              }
            }
            container.addEventListener('touchend', endGesture);
            container.addEventListener('touchcancel', endGesture);
          })();

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

          var SPOT_PAINT = ${JSON.stringify(spotTypePaint)};
          var SPOT_ICONS = ${JSON.stringify(ICONS)};
          var DIFFICULTY_LEVEL = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };
          window.I18N = ${stringsJson};
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

          function paintFor(spotType) {
            return SPOT_PAINT[spotType] || SPOT_PAINT.STREET;
          }

          // Iconos PNG propios; el div exterior lo posiciona Leaflet, la imagen interior puede escalarse al seleccionar
          function getSpotIcon(spotType) {
            if (!spotIcons[spotType]) {
              var iconUrl = SPOT_ICONS[spotType] || SPOT_ICONS.STREET;
              spotIcons[spotType] = L.divIcon({
                className: 'spot-icon',
                html: '<img class="spot-icon-img" src="' + iconUrl + '" alt="" />',
                iconSize: [45, 45],
                iconAnchor: [22, 45],
                popupAnchor: [0, -40]
              });
            }
            return spotIcons[spotType];
          }

          var STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
          function starsSvg(value) {
            var out = '';
            for (var i = 1; i <= 5; i++) {
              var filled = i <= value;
              out += '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '" fill="' +
                (filled ? 'var(--asphalt)' : 'none') + '" stroke="var(--asphalt)" stroke-width="2" stroke-linejoin="round"/></svg>';
            }
            return out;
          }

          var CAMERA_SVG = '<svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="var(--ink-muted)" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

          function createSpotMarker(spot, showAsPlusOneBubble, lngOffset) {
            if(spot.latitude === null || spot.latitude === undefined ||
               spot.longitude === null || spot.longitude === undefined) {
              return null;
            }
                
            var spotType = (spot.spotType || spot.type || 'STREET').toUpperCase();
            var icon = getSpotIcon(spotType);
            var diff = (spot.difficultyLevel || 'INTERMEDIATE').toUpperCase();
            var level = DIFFICULTY_LEVEL[diff] || 2;
            var rating = spot.surfaceRating || 0;

            // El HTML del popup se construye solo al abrirlo (no para cada marcador en cada movimiento)
            var buildPopup = function() {
              var emptyImage = '<div class="popup-image popup-image-empty" role="img" aria-label="' + escapeHtml(window.I18N.noImage) + '">' + CAMERA_SVG + '</div>';
              var image = spot.mediaUrl
                ? '<img src="' + escapeHtml(spot.mediaUrl) + '" class="popup-image" alt="" onerror="this.outerHTML=window.__emptyImage" />'
                : emptyImage;
              window.__emptyImage = emptyImage;
              var marks = '';
              for (var i = 1; i <= 3; i++) marks += '<i class="' + (i <= level ? '' : 'off') + '"></i>';
              var diffLabel = escapeHtml(window.I18N.difficulty[diff] || diff);

              return '<div class="popup-card">' + image +
                '<div class="popup-info">' +
                  '<h3 class="popup-title">' + escapeHtml(spot.name || window.I18N.unnamed) + '</h3>' +
                  '<div class="popup-facts">' +
                    '<span class="type-chip" style="background:' + paintFor(spotType) + '">' + escapeHtml(window.I18N.types[spotType] || spotType) + '</span>' +
                    '<span class="diff" aria-label="' + diffLabel + '"><span class="diff-marks">' + marks + '</span>' + diffLabel + '</span>' +
                  '</div>' +
                  '<div class="popup-rating" aria-label="' + rating.toFixed(1) + ' / 5">' +
                    starsSvg(Math.round(rating)) + '<span class="popup-rating-num">' + rating.toFixed(1) + '</span>' +
                  '</div>' +
                  '<p class="popup-desc">' + escapeHtml(spot.description || window.I18N.noDescription) + '</p>' +
                  '<div class="btn-container">' +
                    '<button class="details-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: \\'openDetails\\', spotId: ' + (Number(spot.id) || 0) + ' }))">' + escapeHtml(window.I18N.rate) + '</button>' +
                    '<button class="directions-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: \\'openDirections\\', lat: ' + Number(spot.latitude) + ', lng: ' + Number(spot.longitude) + ' }))">' + escapeHtml(window.I18N.route) + '</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
            };

            var marker = L.marker([spot.latitude, spot.longitude + (lngOffset || 0)], {
              icon: showAsPlusOneBubble ? singleSpotClusterIcon : icon
            }).bindPopup(buildPopup, { maxWidth: 260, minWidth: 240, autoPanPaddingTopLeft: L.point(16, 96), autoPanPaddingBottomRight: L.point(16, 120) });
            marker.spotId = spot.id;
            return marker;
          }

          // Spot seleccionado (popup abierto): sobrevive a los redibujados y lleva la ruta pintada
          var selectedSpotId = null;
          var selectedLatLng = null;
          var isRerendering = false;

          function renderVisibleSpots() {
            isRerendering = true;
            individualSpotsLayer.clearLayers();
            clusteredSpotsLayer.clearLayers();
            isRerendering = false;
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

            if (selectedSpotId !== null) {
              var selectedMarker = null;
              if (!useClusterLayer) {
                markers.forEach(function(marker) {
                  if (marker.spotId === selectedSpotId && selectedLatLng &&
                      marker.getLatLng().distanceTo(selectedLatLng) < 1) {
                    selectedMarker = marker;
                  }
                });
              }
              if (selectedMarker) {
                selectedMarker.openPopup();
              } else {
                // El spot se ha agrupado o ha salido de pantalla: se suelta la selección
                selectedSpotId = null;
                selectedLatLng = null;
                clearRoute();
              }
            }
          }

          var routeCasing = null;
          var routeLine = null;

          function clearRoute() {
            if (routeCasing) { map.removeLayer(routeCasing); routeCasing = null; }
            if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
          }

          // Ruta pintada: puntos rosas redondos sobre una línea de tinta, del usuario al spot
          function drawRoute() {
            clearRoute();
            if (!userLatLng || !selectedLatLng) return;
            var points = [userLatLng, selectedLatLng];
            var style = { dashArray: '2 12', lineCap: 'round', lineJoin: 'round', interactive: false };
            routeCasing = L.polyline(points, L.extend({ color: '${Palette.asphalt}', weight: 9 }, style)).addTo(map);
            routeLine = L.polyline(points, L.extend({ color: '${Palette.pink}', weight: 6 }, style)).addTo(map);
          }

          function setSelectedClass(marker, isSelected) {
            var el = marker && marker.getElement && marker.getElement();
            if (el) el.classList.toggle('is-selected', isSelected);
          }

          map.on('popupopen', function(e) {
            var marker = e.popup && e.popup._source;
            if (!marker || marker.spotId === undefined) return;
            selectedSpotId = marker.spotId;
            selectedLatLng = marker.getLatLng();
            setSelectedClass(marker, true);
            drawRoute();
          });

          map.on('popupclose', function(e) {
            var marker = e.popup && e.popup._source;
            setSelectedClass(marker, false);
            if (isRerendering) return;
            selectedSpotId = null;
            selectedLatLng = null;
            clearRoute();
          });

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
          var userLatLng = null;
          var radiusTimer = null;

          var blueDotIcon = L.divIcon({
            className: 'blue-dot',
            html: '<div class="blue-dot-inner"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          // El radio (círculo vectorial) se escala de golpe durante un zoom animado y se ve gigante:
          // lo ocultamos al empezar cualquier zoom y lo mostramos con un fundido al terminar.
          function hideRadius() {
            clearTimeout(radiusTimer);
            if (locationCircle) {
              map.removeLayer(locationCircle);
              locationCircle = null;
            }
          }

          function showRadius() {
            clearTimeout(radiusTimer);
            radiusTimer = setTimeout(function() {
              if (!userLatLng || locationCircle) return;
              locationCircle = L.circle(userLatLng, {
                color: '${Palette.asphalt}',
                fillColor: '${Palette.asphalt}',
                fillOpacity: 0.06,
                radius: 200, // 200 metros
                weight: 1.5,
                dashArray: '4 6',
                className: 'user-radius',
                interactive: false
              }).addTo(map);
            }, 150);
          }

          map.on('zoomstart', hideRadius);
          map.on('zoomend', showRadius);

          window.updateUserLocation = function(lat, lng) {
            userLatLng = L.latLng(lat, lng);

            if (userMarker) {
              userMarker.setLatLng(userLatLng);
            } else {
              userMarker = L.marker(userLatLng, { icon: blueDotIcon, zIndexOffset: 1000 }).addTo(map);
            }

            hideRadius();
            if (selectedLatLng) drawRoute();

            // Si ya estamos ahí (p. ej. al afinar la posición) solo movemos el punto, sin volver a hacer zoom
            var distance = map.getCenter().distanceTo(userLatLng);
            if (map.getZoom() >= 15 && distance < 80) {
              showRadius();
              return;
            }

            map.flyTo(userLatLng, 16, {
              animate: true,
              duration: distance > 20000 ? 2.2 : 1.2,
              easeLinearity: 0.25
            });
          };

          map.on('click', function(e) {
            if (window.isAddingMode) {
              if (!userMarker) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'error', 
                    code: 'gpsWaiting'
                 }));
                 return;
              }

              var userLatLng = userMarker.getLatLng();
              var distanceInMeters = userLatLng.distanceTo(e.latlng);

              if (distanceInMeters > 200) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'error', 
                    code: 'tooFar',
                    meters: Math.round(distanceInMeters)
                 }));
                 return;
              }

              if (window.newSpotMarker) {
                map.removeLayer(window.newSpotMarker);
              }
              window.newSpotMarker = L.marker(e.latlng, {
                icon: L.divIcon({ className: 'paint-marker', html: '<div class="proposed-dot"></div>', iconSize: [44, 44], iconAnchor: [22, 22] }),
                interactive: false
              }).addTo(map);
              
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
             if (data.code === 'tooFar') {
               onNotice(t('errors.tooFar', { meters: Number(data.meters) || 0 }));
             } else if (data.code === 'gpsWaiting') {
               onNotice(t('errors.gpsWaiting'));
             }
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
  container: { flex: 1, backgroundColor: Palette.concrete },
  map: { width: '100%', flex: 1 },
});