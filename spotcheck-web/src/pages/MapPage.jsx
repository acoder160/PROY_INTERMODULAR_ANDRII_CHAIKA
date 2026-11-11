import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import FilterSheet from '../components/FilterSheet';
import SpotDetailsSheet from '../components/SpotDetailsSheet';
import AddSpotNotice from '../components/AddSpotNotice';
import { TypeChip, DifficultyMarks, StarRating } from '../components/PaintBits';
import ReportSheet from '../components/ReportSheet';
import ActivityWindow from '../components/ActivityWindow';
import useIsPhone, { PEEK_RATIO } from '../utils/useIsPhone';
import { PlusIcon, OptionsIcon, PersonIcon, RefreshIcon, LocateIcon, ShieldIcon, CameraIcon, CloseIcon, BellIcon, BookmarkIcon } from '../components/Icons';
import Avatar from '../components/Avatar';
import '../Social.css';
import { useLiveCounts } from '../utils/live';
import { DEFAULT_FILTERS, cleanLabel, directionsUrl, haversineKm } from '../utils/paint';
import '../MapChrome.css';

const ASPHALT = '#1C1C1C';
const PINK = '#FF4FA3';

const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
// Здесь мы применяем стиль "voyager", сохраняя передачу твоего ключа
const cartoTileUrl = cartoApiKey
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const cartoAttribution = cartoApiKey
    ? '&copy; OpenStreetMap contributors &copy; CARTO'
    : '&copy; OpenStreetMap contributors';
const spotIconCache = {};
const getSpotIcon = (type, live = 0) => {
    let iconPath = '/icons/icon_street.png'; // Por defecto
    switch (type) {
        case 'STREET': iconPath = '/icons/icon_street.png'; break;
        case 'PARK':   
        case 'SKATEPARK': iconPath = '/icons/icon_park.png'; break;
        case 'RAMPS':  iconPath = '/icons/icon_ramps.png'; break;
        case 'RAIL':   iconPath = '/icons/icon_rail.png'; break;
        case 'LEDGE':  iconPath = '/icons/icon_ledge.png'; break;
    }
    
    // Los PNG no son cuadrados: la imagen se encaja sin deformar (object-fit en .spot-icon-img),
    // igual que en la app móvil. El div exterior lo coloca Leaflet; la imagen puede escalarse al seleccionar.
    const key = `${type}|${live}`;
    if (spotIconCache[key]) return spotIconCache[key];
    // Skaters there right now: a pink count badge on the icon
    const badge = live > 0 ? `<span class="live-badge">${live > 9 ? '9+' : live}</span>` : '';
    spotIconCache[key] = L.divIcon({
        className: live > 0 ? 'spot-icon is-live' : 'spot-icon',
        html: `<img class="spot-icon-img" src="${iconPath}" alt="" />${badge}`,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -40]
    });
    return spotIconCache[key];
};

const singleSpotClusterIcons = {};
const getSingleSpotClusterIcon = (live = false) => singleSpotClusterIcons[live] || (singleSpotClusterIcons[live] = L.divIcon({
    html: '<div class="spot-cluster-label">+1</div>',
    className: `marker-cluster marker-cluster-small${live ? ' has-live' : ''}`,
    iconSize: L.point(42, 42),
}));

// Copias del mundo en las que se dibuja cada spot (izquierda, centro, derecha). Con worldCopyJump
// el mapa vuelve al mundo central al alejarse, así que tres copias cubren cualquier posición.
const WORLD_COPIES = [-360, 0, 360];
const ICON_ZOOM_THRESHOLD = 15;
const CLUSTER_ON_COUNT = 150;   // a partir de aquí (y con zoom bajo) se agrupan en burbujas
const CLUSTER_OFF_COUNT = 130;  // por debajo de esto volvemos a iconos sueltos (evita parpadeo)
const popupContainers = new WeakMap();

// Contenedor del popup: uno por marcador y siempre el mismo, para que React pueda pintar dentro
const getPopupContainer = (marker) => {
    let container = popupContainers.get(marker);
    if (!container) {
        container = L.DomUtil.create('div');
        popupContainers.set(marker, container);
    }
    return container;
};

const createSpotMarker = (spot, offset, icon, live = 0) => {
    const marker = L.marker([spot.latitude, spot.longitude + offset], {
        icon,
        spotId: spot.id,
        spotType: spot.spotType,
        live, // the count the icon was drawn with: lets the live update notice a drop back to 0
    });
    marker.bindPopup(() => getPopupContainer(marker), {
        closeButton: false, // botones propios (denunciar + cerrar) dentro de SpotPopup
        maxWidth: 260,
        minWidth: 240,
        autoPanPaddingTopLeft: L.point(16, 96),
        autoPanPaddingBottomRight: L.point(16, 120),
    });
    return marker;
};

// Recorre los spots (incluidas las copias del mundo) que caen dentro de unos límites
const forEachSpotCopyInBounds = (spots, bounds, callback) => {
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    spots.forEach((spot) => {
        if (spot.latitude === null || spot.latitude === undefined ||
            spot.longitude === null || spot.longitude === undefined) return;
        if (spot.latitude < south || spot.latitude > north) return;
        const firstCopy = Math.ceil((west - spot.longitude) / 360);
        const lastCopy = Math.floor((east - spot.longitude) / 360);
        for (let copy = firstCopy; copy <= lastCopy; copy++) {
            callback(spot, copy * 360);
        }
    });
};

// Quita el prefijo "Leaflet" y pliega el crédito a un icono "i" (se abre al tocarlo); el texto de OpenStreetMap / CARTO sigue ahí
function HideLeafletPrefix() {
    const map = useMap();
    useEffect(() => {
        map.attributionControl?.setPrefix(false);
        const c = map.attributionControl?.getContainer();
        if (!c) return undefined;
        c.classList.add('attr-toggle', 'is-collapsed');
        c.setAttribute('role', 'button');
        c.setAttribute('aria-label', 'Map credits');
        c.tabIndex = 0;
        const toggle = (e) => {
            if (e.target.closest?.('a') && !c.classList.contains('is-collapsed')) return;
            c.classList.toggle('is-collapsed');
        };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); };
        const collapse = () => c.classList.add('is-collapsed');
        c.addEventListener('click', toggle);
        c.addEventListener('keydown', onKey);
        map.on('movestart click', collapse);
        return () => {
            c.removeEventListener('click', toggle);
            c.removeEventListener('keydown', onKey);
            map.off('movestart click', collapse);
        };
    }, [map]);
    return null;
}

// CAPA DE SPOTS: capas nativas de Leaflet (fuera de React). Los marcadores se crean una sola vez
// (grupo de clusters) y Leaflet.markercluster solo pinta lo que cabe en pantalla.
//  - Pocos spots a la vista (< 150): iconos sueltos, nunca burbujas.
//  - Muchos spots y zoom bajo: burbujas "+N" / "+1". Con zoom >= 15: siempre iconos.
function DynamicSpotLayer({ spots, onOpenDetails, favoriteIds, onToggleFavorite, myPosition, liveCounts }) {
    const map = useMap();
    const positionRef = useRef(myPosition);
    const selectedRef = useRef(null);   // marcador con el popup abierto
    const routeRef = useRef([]);        // [contorno de tinta, puntos rosas]
    const zoomingRef = useRef(false);   // hay un zoom animado en curso (flyTo, rueda, pellizco)
    const pendingRouteRef = useRef(false);
    const clusterRef = useRef(null);
    const looseRef = useRef(null);
    const clusterMarkersRef = useRef([]);
    const looseMarkersRef = useRef(new Map());
    const signatureRef = useRef('');
    const modeRef = useRef('cluster'); // 'cluster' | 'loose'
    const loadingRef = useRef(false);   // el grupo aún está cargando marcadores por bloques
    const spotsRef = useRef(spots);
    const liveRef = useRef(liveCounts);
    // The icon a marker should show now: "+1" bubble when zoomed out, the type icon otherwise,
    // both marked when someone is skating there
    const iconFor = useCallback((spotId, spotType, bubble) => {
        const live = liveRef.current.get(spotId) ?? 0;
        return bubble ? getSingleSpotClusterIcon(live > 0) : getSpotIcon(spotType, live);
    }, []);
    const [openPopup, setOpenPopup] = useState(null); // { spotId, container, popup }

    const spotsById = useMemo(() => new Map(spots.map((spot) => [spot.id, spot])), [spots]);

    // Ruta pintada (firma visual): puntos rosas redondos sobre una línea de tinta, del usuario al spot
    const clearRoute = useCallback(() => {
        routeRef.current.forEach((line) => map.removeLayer(line));
        routeRef.current = [];
    }, [map]);

    const drawRoute = useCallback(() => {
        clearRoute();
        const from = positionRef.current;
        const marker = selectedRef.current;
        if (!from || !marker) return;
        // Una línea añadida a mitad de un zoom animado se pinta con doble escala (una mancha rosa y
        // negra enorme): la dibujamos cuando el zoom termina.
        if (zoomingRef.current) {
            pendingRouteRef.current = true;
            return;
        }
        pendingRouteRef.current = false;
        const points = [from, marker.getLatLng()];
        const style = { dashArray: '2 12', lineCap: 'round', lineJoin: 'round', interactive: false };
        routeRef.current = [
            L.polyline(points, { ...style, color: ASPHALT, weight: 9 }).addTo(map),
            L.polyline(points, { ...style, color: PINK, weight: 6 }).addTo(map),
        ];
    }, [map, clearRoute]);

    useEffect(() => {
        positionRef.current = myPosition;
        if (selectedRef.current) drawRoute();
    }, [myPosition, drawRoute]);

    // Evalúa qué modo toca según los spots visibles y el zoom
    const evaluateMode = useCallback(() => {
        const cluster = clusterRef.current;
        const loose = looseRef.current;
        // No cambiamos de capa mientras Leaflet.markercluster sigue cargando marcadores
        if (!cluster || !loose || loadingRef.current) return;

        const zoom = map.getZoom();
        const view = map.getBounds();
        let count = 0;
        forEachSpotCopyInBounds(spotsRef.current, view, () => { count++; });

        let nextMode = modeRef.current;
        if (zoom >= ICON_ZOOM_THRESHOLD) {
            nextMode = 'cluster';  // con zoom alto el grupo ya muestra iconos reales
        } else if (modeRef.current === 'cluster' && count < CLUSTER_OFF_COUNT) {
            nextMode = 'loose';
        } else if (modeRef.current === 'loose' && count >= CLUSTER_ON_COUNT) {
            nextMode = 'cluster';
        }

        if (nextMode !== modeRef.current) {
            modeRef.current = nextMode;
            if (nextMode === 'loose') {
                if (map.hasLayer(cluster)) map.removeLayer(cluster);
                if (!map.hasLayer(loose)) map.addLayer(loose);
            } else {
                if (map.hasLayer(loose)) map.removeLayer(loose);
                if (!map.hasLayer(cluster)) map.addLayer(cluster);
                loose.clearLayers();
                looseMarkersRef.current.clear();
            }
        }

        // Iconos de los marcadores del grupo: burbuja "+1" por debajo del umbral, icono real por encima
        const bubble = zoom < ICON_ZOOM_THRESHOLD;
        clusterMarkersRef.current.forEach((marker) => {
            if (marker.options.bubble !== bubble) {
                marker.options.bubble = bubble;
                marker.setIcon(iconFor(marker.options.spotId, marker.options.spotType, bubble));
            }
        });

        // Modo iconos sueltos: mantenemos solo los marcadores de la zona (con margen)
        if (modeRef.current === 'loose') {
            const area = view.pad(0.5);
            const wanted = new Map();
            forEachSpotCopyInBounds(spotsRef.current, area, (spot, offset) => {
                wanted.set(`${spot.id}_${offset}`, { spot, offset });
            });
            looseMarkersRef.current.forEach((marker, key) => {
                if (!wanted.has(key) && !marker.isPopupOpen()) {
                    loose.removeLayer(marker);
                    looseMarkersRef.current.delete(key);
                }
            });
            wanted.forEach(({ spot, offset }, key) => {
                if (!looseMarkersRef.current.has(key)) {
                    const marker = createSpotMarker(spot, offset, iconFor(spot.id, spot.spotType, false), liveRef.current.get(spot.id) ?? 0);
                    looseMarkersRef.current.set(key, marker);
                    loose.addLayer(marker);
                }
            });
        }
    }, [map, iconFor]);

    // 1. Capas (se crean una vez)
    useEffect(() => {
        const cluster = L.markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 25,
            chunkProgress: (processed, total) => {
                // Solo al terminar una carga real; evaluamos fuera de esta llamada (no tocar capas aquí dentro)
                if (loadingRef.current && total > 0 && processed >= total) {
                    loadingRef.current = false;
                    setTimeout(evaluateMode, 0);
                }
            },
            maxClusterRadius: 40,
            disableClusteringAtZoom: ICON_ZOOM_THRESHOLD,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            animate: false,
            iconCreateFunction: (group) => {
                const count = group.getChildCount();
                const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
                // Someone skating inside the bubble: it gets the pink live ring too
                const live = group.getAllChildMarkers().some((m) => (liveRef.current.get(m.options.spotId) ?? 0) > 0);
                return L.divIcon({
                    html: `<div class="spot-cluster-label">+${count}</div>`,
                    className: `marker-cluster marker-cluster-${size}${live ? ' has-live' : ''}`,
                    iconSize: L.point(42, 42),
                });
            },
        });
        const loose = L.featureGroup();

        const onPopupOpen = (e) => {
            const marker = e.propagatedFrom;
            const container = popupContainers.get(marker);
            // The top bar can take one or two rows: pan the card below its real edge, not a fixed guess.
            // The content renders right after this and the ResizeObserver's update() pans with this padding.
            const barBottom = document.querySelector('.map-topbar')?.getBoundingClientRect().bottom ?? 80;
            e.popup.options.autoPanPaddingTopLeft = L.point(16, Math.round(barBottom) + 16);
            selectedRef.current = marker;
            marker.getElement()?.classList.add('is-selected');
            drawRoute();
            if (container) setOpenPopup({ spotId: marker.options.spotId, container, popup: e.popup });
        };
        const onPopupClose = (e) => {
            e.propagatedFrom?.getElement()?.classList.remove('is-selected');
            if (selectedRef.current === e.propagatedFrom) selectedRef.current = null;
            clearRoute();
            setOpenPopup(null);
        };
        [cluster, loose].forEach((layer) => {
            layer.on('popupopen', onPopupOpen);
            layer.on('popupclose', onPopupClose);
        });

        let timer = null;
        const scheduleEvaluate = () => {
            clearTimeout(timer);
            timer = setTimeout(evaluateMode, 100);
        };
        map.on('moveend zoomend', scheduleEvaluate);

        // moveend también cierra el estado: un arrastre que corta un flyTo no emite zoomend
        const onZoomStart = () => { zoomingRef.current = true; };
        const onZoomDone = () => {
            if (!zoomingRef.current) return;
            zoomingRef.current = false;
            if (pendingRouteRef.current) drawRoute();
        };
        map.on('zoomstart', onZoomStart);
        map.on('zoomend moveend', onZoomDone);

        clusterRef.current = cluster;
        looseRef.current = loose;
        modeRef.current = 'cluster';
        signatureRef.current = '';
        loadingRef.current = false;
        map.addLayer(cluster);

        return () => {
            clearTimeout(timer);
            map.off('moveend zoomend', scheduleEvaluate);
            map.off('zoomstart', onZoomStart);
            map.off('zoomend moveend', onZoomDone);
            // Si aún queda una carga por bloques en marcha, que no intente añadir a un mapa sin capa
            cluster._addLayer = () => {};
            map.removeLayer(cluster);
            map.removeLayer(loose);
            clusterRef.current = null;
            looseRef.current = null;
            selectedRef.current = null;
            clearRoute();
        };
    }, [map, evaluateMode, drawRoute, clearRoute]);

    // 2. Crear los marcadores solo cuando cambia el conjunto de spots (no al mover el mapa)
    useEffect(() => {
        spotsRef.current = spots;
        const cluster = clusterRef.current;
        const loose = looseRef.current;
        if (!cluster || !loose) return;

        const signature = spots
            .map((spot) => `${spot.id}:${spot.latitude}:${spot.longitude}:${spot.spotType}`)
            .join('|');
        if (signature === signatureRef.current) return;
        signatureRef.current = signature;

        cluster.clearLayers();
        loose.clearLayers();
        looseMarkersRef.current.clear();

        const bubble = map.getZoom() < ICON_ZOOM_THRESHOLD;
        const markers = [];
        spots.forEach((spot) => {
            if (spot.latitude === null || spot.latitude === undefined ||
                spot.longitude === null || spot.longitude === undefined) return;
            WORLD_COPIES.forEach((offset) => {
                const marker = createSpotMarker(spot, offset, iconFor(spot.id, spot.spotType, bubble), liveRef.current.get(spot.id) ?? 0);
                marker.options.bubble = bubble;
                markers.push(marker);
            });
        });

        clusterMarkersRef.current = markers;
        modeRef.current = 'cluster';
        if (!map.hasLayer(cluster)) map.addLayer(cluster);
        if (map.hasLayer(loose)) map.removeLayer(loose);
        loadingRef.current = markers.length > 0;
        cluster.addLayers(markers); // al terminar, chunkProgress llama a evaluateMode
        if (markers.length === 0) evaluateMode();
    }, [map, spots, evaluateMode, iconFor]);

    // 2b. Live counts changed: swap the icons of the affected markers only, then redraw bubbles
    useEffect(() => {
        liveRef.current = liveCounts;
        const changed = [];
        const update = (marker) => {
            const live = liveCounts.get(marker.options.spotId) ?? 0;
            if ((marker.options.live ?? 0) === live) return;
            marker.options.live = live;
            marker.setIcon(iconFor(marker.options.spotId, marker.options.spotType, Boolean(marker.options.bubble)));
            changed.push(marker);
        };
        clusterMarkersRef.current.forEach(update);
        looseMarkersRef.current.forEach(update);
        if (changed.length && clusterRef.current) clusterRef.current.refreshClusters(changed);
    }, [liveCounts, iconFor]);

    // 3. El contenido del popup (React) cambia de tamaño: avisamos a Leaflet para recolocarlo
    useEffect(() => {
        if (!openPopup) return;
        const observer = new ResizeObserver(() => openPopup.popup.update());
        observer.observe(openPopup.container);
        return () => observer.disconnect();
    }, [openPopup]);

    const closePopup = useCallback(() => map.closePopup(), [map]);
    const currentSpot = openPopup ? spotsById.get(openPopup.spotId) : null;
    return currentSpot
        ? createPortal(
            <SpotPopup spot={currentSpot} onOpenDetails={onOpenDetails} isFavorite={favoriteIds.has(currentSpot.id)} onToggleFavorite={onToggleFavorite} onClose={closePopup} />,
            openPopup.container
        )
        : null;
}

// POPUP DEL SPOT: misma tarjeta que el popup de la app móvil (spotcheck-mobile/components/spotcheck.tsx)
function SpotPopup({ spot, onOpenDetails, isFavorite, onToggleFavorite, onClose }) {
    const { t } = useTranslation();
    const [imageFailed, setImageFailed] = useState(false);
    const spotType = (spot.spotType || spot.type || 'STREET').toUpperCase();
    const difficulty = (spot.difficultyLevel || 'INTERMEDIATE').toUpperCase();
    const rating = spot.surfaceRating || 0;

    return (
        <div className="popup-card">
            <div className="popup-media">
                {spot.mediaUrl && !imageFailed ? (
                    <img src={spot.mediaUrl} className="popup-image" alt="" onError={() => setImageFailed(true)} />
                ) : (
                    <div className="popup-image popup-image-empty" role="img" aria-label={t('popup.noImage')}>
                        <CameraIcon size={32} />
                    </div>
                )}
                {/* Iconos SVG centrados con grid: el carácter "×" de la fuente quedaba 3px por debajo del centro */}
                <div className="popup-actions">
                    <button
                        type="button"
                        className={`popup-icon-btn${isFavorite ? ' is-on' : ''}`}
                        onClick={() => onToggleFavorite(spot.id)}
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? t('social.saved') : t('social.save')}
                        title={isFavorite ? t('social.saved') : t('social.save')}
                    >
                        <BookmarkIcon size={18} filled={isFavorite} />
                    </button>
                    <button type="button" className="popup-icon-btn" onClick={onClose} aria-label={cleanLabel(t('form.close'))}>
                        <CloseIcon size={18} />
                    </button>
                </div>
            </div>
            <div className="popup-info">
                <h3 className="popup-title">{spot.name || t('webview.unnamed')}</h3>
                <div className="popup-facts">
                    <TypeChip type={spotType} label={t(`types.${spotType}`, { defaultValue: spotType })} />
                    <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
                </div>
                <div className="popup-rating">
                    <StarRating value={Math.round(rating)} size={16} label={(n) => `${n} / 5`} />
                    <span className="popup-rating-num">{rating.toFixed(1)}</span>
                </div>
                <p className="popup-desc">{spot.description || t('webview.noDescription')}</p>
                <div className="btn-container">
                    <button type="button" className="details-btn" onClick={() => { onOpenDetails(spot.id); onClose?.(); }}>
                        {cleanLabel(t('webview.rate'))}
                    </button>
                    <a className="directions-btn" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
                        {cleanLabel(t('webview.route'))}
                    </a>
                </div>
            </div>
        </div>
    );
}

// TILES CON PRERENDER: carga una franja extra de tiles alrededor de la pantalla (en todas las
// direcciones) y conserva los que quedan detrás, así al arrastrar rápido no se ve el fondo gris.
const PRELOAD_TILES = 2;   // cuántos tiles extra se cargan por delante, en cada lado
const PaddedTileLayer = L.TileLayer.extend({
    _getTiledPixelBounds(center) {
        const bounds = L.TileLayer.prototype._getTiledPixelBounds.call(this, center);
        const pad = this.getTileSize().x * PRELOAD_TILES;
        return L.bounds(bounds.min.subtract([pad, pad]), bounds.max.add([pad, pad]));
    },
});

function PrerenderedTiles() {
    const map = useMap();

    useEffect(() => {
        const layer = new PaddedTileLayer(cartoTileUrl, {
            attribution: cartoAttribution,
            maxZoom: 19,
            maxNativeZoom: 18,
            keepBuffer: 8,          // tiles que se conservan detrás/alrededor antes de descartarlos
            updateWhenIdle: false,  // cargar mientras se arrastra, no al soltar
            updateWhenZooming: false,
            updateInterval: 80,
        });
        layer.addTo(map);
        return () => {
            map.removeLayer(layer);
        };
    }, [map]);

    return null;
}

// LÍMITE DE ZOOM: el mundo siempre llena la pantalla (no se puede alejar más allá del borde del mapa)
const WORLD_BOUNDS = L.latLngBounds([-85.0511, -180], [85.0511, 180]);

function ZoomLimit() {
    const map = useMap();

    useEffect(() => {
        const applyMinZoom = () => {
            const worldZoom = map.getBoundsZoom(WORLD_BOUNDS, true);
            map.setMinZoom(worldZoom);
            if (map.getZoom() < worldZoom) {
                map.setZoom(worldZoom, { animate: false });
            }
        };

        applyMinZoom();
        map.on('resize', applyMinZoom);
        return () => {
            map.off('resize', applyMinZoom);
        };
    }, [map]);

    return null;
}

// PUNTO DE UBICACIÓN + RADIO
// El punto es un marcador DOM (no se deforma al hacer zoom). El radio es un círculo vectorial:
// durante un zoom animado Leaflet escala la capa SVG entera, así que un círculo añadido a mitad
// del zoom sale con doble escala (la mancha negra). Lo quitamos al empezar el zoom y solo lo
// volvemos a pintar cuando el zoom ha terminado.
const userDotIcon = L.divIcon({
    className: 'user-dot',
    html: '<div class="user-dot-inner"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

function UserLocation({ position }) {
    const map = useMap();
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const timerRef = useRef(null);
    const positionRef = useRef(null);
    const controlsRef = useRef(null);
    const zoomingRef = useRef(false);

    useEffect(() => {
        const hideRadius = () => {
            clearTimeout(timerRef.current);
            if (circleRef.current) {
                map.removeLayer(circleRef.current);
                circleRef.current = null;
            }
        };
        const showRadius = () => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                const pos = positionRef.current;
                if (!pos || circleRef.current || zoomingRef.current) return;
                const radius = Math.min(Math.max(pos.accuracy || 100, 40), 500);
                circleRef.current = L.circle(pos, {
                    color: ASPHALT,
                    fillColor: ASPHALT,
                    fillOpacity: 0.06,
                    weight: 1.5,
                    dashArray: '4 6',
                    radius,
                    className: 'user-radius',
                    interactive: false,
                }).addTo(map);
            }, 150);
        };

        const onZoomStart = () => {
            zoomingRef.current = true;
            hideRadius();
        };
        // moveend también cuenta: un arrastre que corta un flyTo no emite zoomend
        const onZoomDone = () => {
            if (!zoomingRef.current) return;
            zoomingRef.current = false;
            showRadius();
        };

        map.on('zoomstart', onZoomStart);
        map.on('zoomend moveend', onZoomDone);
        controlsRef.current = { hideRadius, showRadius };

        return () => {
            map.off('zoomstart', onZoomStart);
            map.off('zoomend moveend', onZoomDone);
            hideRadius();
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
        };
    }, [map]);

    useEffect(() => {
        if (!position) return;
        positionRef.current = position;
        if (markerRef.current) {
            markerRef.current.setLatLng(position);
        } else {
            markerRef.current = L.marker(position, { icon: userDotIcon, zIndexOffset: 1000, interactive: false }).addTo(map);
        }
        controlsRef.current?.hideRadius();
        // Si el mapa está volando hacia la posición, el radio aparece al terminar (onZoomDone)
        if (!zoomingRef.current) controlsRef.current?.showRadius();
    }, [map, position]);

    return null;
}

// Vuela al spot abierto desde un enlace (?spot=) o desde la lista de un perfil / la actividad
// `inset`: píxeles de abajo que tapará la hoja del spot (teléfono); el spot aterriza en la franja visible de arriba
function FocusSpot({ focus, inset }) {
    const map = useMap();
    const insetRef = useRef(inset);
    useEffect(() => { insetRef.current = inset; }, [inset]); // read when a flight starts, without restarting it
    useEffect(() => {
        if (!focus) return;
        const zoom = Math.max(map.getZoom(), 16);
        let target = L.latLng(focus.lat, focus.lng);
        if (insetRef.current) {
            target = map.unproject(map.project(target, zoom).add([0, insetRef.current / 2]), zoom);
        }
        map.flyTo(target, zoom, { duration: 1.2 });
    }, [focus, map]);
    return null;
}

// Al abrir un spot tocando su marcador (teléfono): si queda bajo la hoja o fuera de la franja visible, se desplaza el mapa
// para que se vea sobre ella. `skipRef` evita pelearse con FocusSpot, que ya lo coloca al volar a un enlace.
function RevealSpot({ spotId, lat, lng, inset, skipRef }) {
    const map = useMap();
    useEffect(() => {
        if (spotId == null || !inset) return;
        if (skipRef.current === spotId) { skipRef.current = null; return; }
        const point = map.latLngToContainerPoint([lat, lng]);
        const size = map.getSize();
        const hidden = point.y > size.y - inset - 48 || point.y < 96 || point.x < 24 || point.x > size.x - 24;
        if (!hidden) return;
        map.panBy([point.x - size.x / 2, point.y - (size.y - inset) / 2], { animate: true, duration: 0.4 });
    // Solo al abrir otro spot: mover el mapa cada vez que cambie `inset` o los datos del spot sería molesto
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spotId]);
    return null;
}

// Contador de notificaciones sin leer: se consulta al entrar y cada minuto mientras la pestaña está visible
function useUnreadCount(enabled) {
    const [unread, setUnread] = useState(0);
    const clear = useCallback(() => setUnread(0), []);
    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        const check = () => {
            if (document.visibilityState !== 'visible') return;
            api.get('/notifications/unread-count')
                .then((res) => { if (!cancelled) setUnread(res.data.unread ?? 0); })
                .catch(() => {});
        };
        check();
        const timer = setInterval(check, 60000);
        document.addEventListener('visibilitychange', check);
        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
        };
    }, [enabled]);
    return [enabled ? unread : 0, clear];
}

// BOTÓN GEOLOCALIZACIÓN (abajo a la derecha) + aviso de estado
function LocationButton({ setMyPosition }) {
    const { t } = useTranslation();
    const map = useMap();
    const buttonRef = useRef(null);
    const timerRef = useRef(null);
    const [message, setMessage] = useState(null);

    // Evita que los clics/arrastres sobre el botón lleguen al mapa
    useEffect(() => {
        if (buttonRef.current) L.DomEvent.disableClickPropagation(buttonRef.current);
        return () => clearTimeout(timerRef.current);
    }, []);

    const showMessage = (text) => {
        clearTimeout(timerRef.current);
        setMessage(text);
        timerRef.current = setTimeout(() => setMessage(null), 4000);
    };

    // silent: arranque automático, sin mensajes (no hay clic del usuario que explicar)
    const goToMyLocation = useCallback(({ silent = false } = {}) => {
        if (!navigator.geolocation) {
            if (!silent) showMessage(t('map.geoUnsupported'));
            return;
        }
        if (!silent) {
            clearTimeout(timerRef.current);
            setMessage(cleanLabel(t('status.gettingLocation')));
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
                latlng.accuracy = pos.coords.accuracy;
                if (!silent) setMessage(null);

                // Vuelo suave: más largo si el destino está lejos; si ya estamos cerca, solo desplazamos.
                // Primero arranca el vuelo (emite zoomstart en el acto) y después se guarda la posición:
                // así el radio y la ruta saben que hay un zoom en curso y esperan a que termine.
                const distance = map.getCenter().distanceTo(latlng);
                if (map.getZoom() >= 15 && distance < 80) {
                    map.panTo(latlng, { animate: true, duration: 0.5 });
                } else {
                    map.flyTo(latlng, 16, {
                        animate: true,
                        duration: distance > 20000 ? 2.2 : 1.2,
                        easeLinearity: 0.25,
                    });
                }
                setMyPosition(latlng);
            },
            (err) => {
                console.error('Error de geolocalización:', err);
                if (!silent) showMessage(err.code === 1 ? t('map.geoDenied') : t('map.geoFailed'));
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
        );
    }, [map, t, setMyPosition]);

    // Si el permiso ya está concedido, el mapa abre donde está el usuario en vez de en una ciudad fija. Sin permiso
    // no se pregunta nada al cargar: el botón "Mi ubicación" (abajo a la derecha) es la invitación.
    const autoLocated = useRef(false);
    useEffect(() => {
        if (autoLocated.current || !navigator.permissions?.query || !navigator.geolocation) return undefined;
        let cancelled = false;
        navigator.permissions.query({ name: 'geolocation' })
            .then((status) => {
                if (cancelled || autoLocated.current || status.state !== 'granted') return;
                autoLocated.current = true;
                goToMyLocation({ silent: true });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [goToMyLocation]);

    return (
        <>
            <div className="map-toast-slot" aria-live="polite">
                {message && <div className="map-toast">{message}</div>}
            </div>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => goToMyLocation()}
                className="map-fab map-fab-right"
                title={t('map.myLocation')}
                aria-label={t('map.centerOnMe')}
            >
                <LocateIcon size={26} />
            </button>
        </>
    );
}

const EMPTY_SET = new Set();

const HINT_KEY = 'spotcheck.mapHintSeen';
const readHintSeen = () => {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; }
};

// Pista de primer uso: qué se toca en el mapa. Tres líneas, una vez, y se va con un toque (sin modal ni tour)
function MapHint({ onDismiss }) {
    const { t } = useTranslation();
    return (
        <aside className="map-hint" aria-label={t('map.hintTitle')}>
            <h2 className="map-hint-title">{t('map.hintTitle')}</h2>
            <ul className="map-hint-list">
                <li>{t('map.hintSpot')}</li>
                <li>{t('map.hintCluster')}</li>
                <li>{t('map.hintLive')}</li>
            </ul>
            <button type="button" className="btn-dark btn-small" onClick={onDismiss}>{t('map.hintDismiss')}</button>
        </aside>
    );
}

export default function MapPage() {
    const { t } = useTranslation();
    const [spots, setSpots] = useState([]);
    const [myPosition, setMyPosition] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [selectedSpotId, setSelectedSpotId] = useState(null);
    const [reportSpotId, setReportSpotId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [focus, setFocus] = useState(null);
    const [showAddNotice, setShowAddNotice] = useState(false);

    // Phones: the spot sheet peeks over the lower half, so the map keeps the spot in the strip above it
    const isPhone = useIsPhone();
    const peekInset = isPhone ? Math.round(window.innerHeight * PEEK_RATIO) : 0;
    const skipRevealFor = useRef(null);

    // First-run hint, shown once (until dismissed or until a spot is opened)
    const [hintSeen, setHintSeen] = useState(readHintSeen);
    const dismissHint = useCallback(() => {
        setHintSeen(true);
        try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage blocked: it just shows again next visit */ }
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();

    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [unread, clearUnread] = useUnreadCount(Boolean(user));

    // Feed and notifications are windows over the map, kept in the URL (?panel=feed|notifications) so Back closes
    // them and old /feed and /notifications links land here. A spot link (?spot=) replaces the param and closes them.
    // One "Activity" window with two tabs; the tab is the param value, so old /feed and /notifications links still land right.
    const panelParam = searchParams.get('panel');
    const panel = panelParam === 'feed' || panelParam === 'notifications' ? panelParam : null;
    const openPanel = useCallback((name) => setSearchParams({ panel: name }), [setSearchParams]);
    const switchPanel = useCallback((name) => setSearchParams({ panel: name }, { replace: true }), [setSearchParams]);
    const closePanel = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);
    const liveCounts = useLiveCounts();

    // Saved spots: one list for the whole map, so the popup and the spot sheet always agree
    const [favoriteIds, setFavoriteIds] = useState(() => new Set());
    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        api.get('/favorites')
            .then((res) => { if (!cancelled) setFavoriteIds(new Set(res.data)); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [user]);
    const visibleFavoriteIds = user ? favoriteIds : EMPTY_SET;

    const toggleFavorite = useCallback(async (spotId) => {
        if (!user) { navigate('/login'); return; }
        const saved = favoriteIds.has(spotId);
        const flip = (prev, on) => {
            const next = new Set(prev);
            if (on) next.add(spotId); else next.delete(spotId);
            return next;
        };
        setFavoriteIds((prev) => flip(prev, !saved));
        try {
            if (saved) await api.delete(`/favorites/${spotId}`);
            else await api.put(`/favorites/${spotId}`);
        } catch {
            setFavoriteIds((prev) => flip(prev, saved)); // put it back
        }
    }, [user, favoriteIds, navigate]);
    const initialCenter = [41.3874, 2.1686]; // Barcelona
    const username = user?.username;

    // One loader for the first load, Reload, Retry and the refresh after an edit. 'slow' after 3 s:
    // the free-tier backend can take 1-2 minutes to wake, and a blank map must not read as "no spots".
    const [loadStatus, setLoadStatus] = useState('loading'); // 'loading' | 'slow' | 'ready' | 'error'
    const loadRun = useRef(0);
    const fetchSpots = useCallback(async () => {
        const run = ++loadRun.current;
        setLoadStatus('loading');
        const slowTimer = setTimeout(() => {
            if (run === loadRun.current) setLoadStatus('slow');
        }, 3000);
        try {
            const response = await api.get('/spots');
            if (run !== loadRun.current) return;
            setSpots(response.data);
            setLoadStatus('ready');
        } catch (error) {
            console.error('Error cargando spots:', error);
            if (run === loadRun.current) setLoadStatus('error');
        } finally {
            clearTimeout(slowTimer);
        }
    }, []);

    useEffect(() => {
        fetchSpots();
        return () => { loadRun.current += 1; }; // a late answer after leaving the map is dropped
    }, [fetchSpots]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchSpots();
        setRefreshing(false);
    };

    // ?spot=123 (enlace compartido, actividad, perfil): abre el spot y vuela a él. Si el mapa aún no lo
    // tiene (recién creado, o la lista llegó antes) se pide suelto.
    const linkedSpotId = Number(searchParams.get('spot')) || null;
    useEffect(() => {
        if (!linkedSpotId) return undefined;
        let cancelled = false;
        const open = (spot) => {
            skipRevealFor.current = spot.id; // FocusSpot already places it above the sheet
            setSelectedSpotId(spot.id);
            setFocus({ lat: spot.latitude, lng: spot.longitude, id: spot.id });
            setSearchParams({}, { replace: true });
        };
        const known = spots.find((s) => s.id === linkedSpotId);
        if (known) {
            open(known);
        } else {
            api.get(`/spots/${linkedSpotId}`)
                .then((res) => {
                    if (cancelled) return;
                    setSpots((prev) => (prev.some((s) => s.id === res.data.id) ? prev : [...prev, res.data]));
                    open(res.data);
                })
                .catch(() => { if (!cancelled) setSearchParams({}, { replace: true }); });
        }
        return () => { cancelled = true; };
    }, [linkedSpotId, spots, setSearchParams]);

    const removeSpot = useCallback((id) => setSpots((prev) => prev.filter((s) => s.id !== id)), []);

    const activeFilterCount = (filters.spotType !== 'ALL' ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.maxDistance > 0 ? 1 : 0);

    const filteredSpots = useMemo(() => spots.filter((spot) => {
        if (filters.spotType !== 'ALL' && spot.spotType !== filters.spotType) return false;
        if (filters.minRating > 0 && (spot.surfaceRating || 0) < filters.minRating) return false;
        if (filters.maxDistance > 0 && myPosition) {
            const distance = haversineKm(myPosition.lat, myPosition.lng, spot.latitude, spot.longitude);
            if (distance > filters.maxDistance) return false;
        }
        return true;
    }), [spots, filters, myPosition]);

    const selectedSpot = selectedSpotId === null ? null : spots.find((s) => s.id === selectedSpotId) ?? null;
    // Opening a spot is the lesson the hint teaches
    useEffect(() => { if (selectedSpotId !== null) dismissHint(); }, [selectedSpotId, dismissHint]);
    const reportSpot = reportSpotId === null ? null : spots.find((s) => s.id === reportSpotId) ?? null;
    const closeDetails = useCallback(() => {
        setSelectedSpotId(null);
        if (searchParams.has('spot')) {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('spot');
                return next;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    const closeFilters = useCallback(() => setShowFilters(false), []);
    const closeReport = useCallback(() => setReportSpotId(null), []);

    // Honest state (PRODUCT.md): say why the map is empty instead of leaving a blank map
    const noDataYet = spots.length === 0 && loadStatus !== 'ready';
    const filtersHideEverything = loadStatus === 'ready' && spots.length > 0 && filteredSpots.length === 0;
    let statusNotice = null;
    if (loadStatus === 'error') {
        statusNotice = (
            <>
                <span className="map-status-text">{t('map.loadFailed')}</span>
                <button type="button" className="map-status-action" onClick={fetchSpots}>{t('map.retry')}</button>
            </>
        );
    } else if (loadStatus === 'slow') {
        statusNotice = (
            <>
                <span className="map-status-spinner" aria-hidden="true" />
                <span className="map-status-text">{t('map.serverWaking')}</span>
            </>
        );
    } else if (filtersHideEverything) {
        statusNotice = (
            <>
                <span className="map-status-text">{t('map.noMatches')}</span>
                <button type="button" className="map-status-action" onClick={() => setFilters(DEFAULT_FILTERS)}>{t('map.resetFilters')}</button>
            </>
        );
    }

    return (
        <div className="map-page">
            <h1 className="visually-hidden">SpotCheck</h1>
            {/* Barra superior asfalto: ajustes del mapa a la izquierda (filtros + idioma), cuenta y actividad a la derecha */}
            <header className="map-topbar">
                <div className="bar-left">
                    <button
                        type="button"
                        onClick={() => setShowFilters(true)}
                        className="bar-pill"
                        aria-label={activeFilterCount > 0 ? `${t('map.filtersActive')}: ${activeFilterCount}` : t('map.filters')}
                    >
                        <OptionsIcon size={20} />
                        <span className="bar-pill-text">{t('map.filters')}</span>
                        {activeFilterCount > 0 && <span className="count-badge" aria-hidden="true">{activeFilterCount}</span>}
                    </button>
                    <LanguageSwitcher />
                </div>

                <div className="bar-right">
                    {isAdmin && (
                        <button type="button" onClick={() => navigate('/admin')} className="bar-pill" aria-label={t('map.admin')}>
                            <ShieldIcon size={18} />
                            <span className="bar-pill-text bar-hide-narrow">{t('map.admin')}</span>
                        </button>
                    )}
                    {user && (
                        // Feed and notifications are one entry: unread news open on Notifications, otherwise on the Feed
                        <button
                            type="button"
                            onClick={() => openPanel(unread > 0 ? 'notifications' : 'feed')}
                            aria-haspopup="dialog"
                            className="bar-pill"
                            aria-label={unread > 0 ? `${t('social.activityTitle')}: ${unread}` : t('social.activityTitle')}
                        >
                            <BellIcon size={20} />
                            <span className="bar-pill-text bar-hide-tiny">{t('social.activityTitle')}</span>
                            {unread > 0 && <span className="count-badge is-alert" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
                        </button>
                    )}
                    {user ? (
                        <button type="button" onClick={() => navigate(`/u/${encodeURIComponent(username)}`)} className="bar-pill bar-pill-account" aria-label={`${username}. ${t('social.profile')}`}>
                            <Avatar username={username} size={24} />
                            <span className="bar-pill-text bar-hide-phone">{username}</span>
                        </button>
                    ) : (
                        <button type="button" onClick={() => navigate('/login')} className="bar-pill bar-pill-account">
                            <PersonIcon size={18} />
                            <span className="bar-pill-text">{t('map.enter')}</span>
                        </button>
                    )}
                </div>

                {/* Estado de carga / error / filtros sin resultados: píldora amarilla bajo la barra (DESIGN.md > Notices).
                    Va dentro de la barra para quedar siempre debajo de ella, también cuando ocupa dos filas. */}
                <div className="map-status-slot" role="status" aria-live="polite">
                    {statusNotice && <div className="map-status">{statusNotice}</div>}
                </div>
            </header>

            {!hintSeen && loadStatus === 'ready' && spots.length > 0 && !selectedSpot && !showFilters && !panel && (
                <MapHint onDismiss={dismissHint} />
            )}

            {/* Añadir spot (centro abajo, rosado, como en la app móvil): en la web solo se explica que se hace desde la app */}
            <button
                type="button"
                className="map-fab map-fab-add"
                onClick={() => setShowAddNotice(true)}
                aria-haspopup="dialog"
            >
                <PlusIcon size={26} />
                <span>{t('map.addSpot')}</span>
            </button>
            <AddSpotNotice open={showAddNotice} onClose={() => setShowAddNotice(false)} />

            {/* Recargar (abajo a la izquierda) */}
            <button
                type="button"
                onClick={handleRefresh}
                className={`map-fab map-fab-left${refreshing ? ' is-spinning' : ''}`}
                title={t('map.reloadSpots')}
                aria-label={t('map.reloadSpots')}
                aria-busy={refreshing}
            >
                <RefreshIcon size={26} />
            </button>

            <MapContainer
                center={initialCenter}
                zoom={14}
                className="map-canvas"
                zoomControl={false}
                maxBounds={[[-85.0511, -Infinity], [85.0511, Infinity]]}
                maxBoundsViscosity={1.0}
                worldCopyJump
            >
                <ZoomLimit />
                <HideLeafletPrefix />
                <PrerenderedTiles />
                <LocationButton setMyPosition={setMyPosition} />
                <DynamicSpotLayer spots={filteredSpots} onOpenDetails={setSelectedSpotId} favoriteIds={visibleFavoriteIds} onToggleFavorite={toggleFavorite} myPosition={myPosition} liveCounts={liveCounts} />
                <UserLocation position={myPosition} />
                <FocusSpot focus={focus} inset={peekInset} />
                {selectedSpot && (
                    <RevealSpot spotId={selectedSpot.id} lat={selectedSpot.latitude} lng={selectedSpot.longitude} inset={peekInset} skipRef={skipRevealFor} />
                )}
            </MapContainer>

            <FilterSheet
                open={showFilters}
                onClose={closeFilters}
                filters={filters}
                setFilters={setFilters}
                resultCount={filteredSpots.length}
                countPending={noDataYet}
                hasLocation={!!myPosition}
            />

            {selectedSpot && (
                <SpotDetailsSheet
                    key={`spot-details-${selectedSpot.id}`}
                    spot={selectedSpot}
                    userLocation={myPosition}
                    onClose={closeDetails}
                    onSpotUpdated={fetchSpots}
                    onSpotDeleted={removeSpot}
                    onReport={setReportSpotId}
                    isFavorite={visibleFavoriteIds.has(selectedSpot.id)}
                    onToggleFavorite={toggleFavorite}
                    liveCount={liveCounts.get(selectedSpot.id) ?? 0}
                />
            )}

            {reportSpot && (
                <ReportSheet key={`spot-report-${reportSpot.id}`} spot={reportSpot} onClose={closeReport} />
            )}

            {panel && <ActivityWindow tab={panel} onTab={switchPanel} onClose={closePanel} onRead={clearUnread} unread={unread} />}
        </div>
    );
}

