import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../MapChrome.css'; 

const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
// Здесь мы применяем стиль "voyager", сохраняя передачу твоего ключа
const cartoTileUrl = cartoApiKey
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const cartoAttribution = cartoApiKey
    ? '&copy; OpenStreetMap contributors &copy; CARTO'
    : '&copy; OpenStreetMap contributors';
const spotIconCache = {};
const getSpotIcon = (type) => {
    if (spotIconCache[type]) return spotIconCache[type];
    let iconPath = '/icons/icon_street.png'; // Por defecto
    switch (type) {
        case 'STREET': iconPath = '/icons/icon_street.png'; break;
        case 'PARK':   
        case 'SKATEPARK': iconPath = '/icons/icon_park.png'; break;
        case 'RAMPS':  iconPath = '/icons/icon_ramps.png'; break;
        case 'RAIL':   iconPath = '/icons/icon_rail.png'; break;
        case 'LEDGE':  iconPath = '/icons/icon_ledge.png'; break;
    }
    
    spotIconCache[type] = L.icon({
        iconUrl: iconPath,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -40]
    });
    return spotIconCache[type];
};

let singleSpotClusterIcon = null;
const getSingleSpotClusterIcon = () => singleSpotClusterIcon || (singleSpotClusterIcon = L.divIcon({
    html: '<div class="spot-cluster-label">+1</div>',
    className: 'marker-cluster marker-cluster-small',
    iconSize: L.point(42, 42),
}));

//  DICCIONARIO PARA TRADUCIR DIFICULTAD 
const difficultyLabels = {
    'BEGINNER': 'Fácil',
    'INTERMEDIATE': 'Medio',
    'ADVANCED': 'Pro'
};

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

const createSpotMarker = (spot, offset, icon) => {
    const marker = L.marker([spot.latitude, spot.longitude + offset], {
        icon,
        spotId: spot.id,
        spotType: spot.spotType,
    });
    marker.bindPopup(() => getPopupContainer(marker));
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

// CAPA DE SPOTS: capas nativas de Leaflet (fuera de React). Los marcadores se crean una sola vez
// (grupo de clusters) y Leaflet.markercluster solo pinta lo que cabe en pantalla.
//  - Pocos spots a la vista (< 150): iconos sueltos, nunca burbujas.
//  - Muchos spots y zoom bajo: burbujas "+N" / "+1". Con zoom >= 15: siempre iconos.
function DynamicSpotLayer({ spots, onUpdate }) {
    const map = useMap();
    const clusterRef = useRef(null);
    const looseRef = useRef(null);
    const clusterMarkersRef = useRef([]);
    const looseMarkersRef = useRef(new Map());
    const signatureRef = useRef('');
    const modeRef = useRef('cluster'); // 'cluster' | 'loose'
    const loadingRef = useRef(false);   // el grupo aún está cargando marcadores por bloques
    const spotsRef = useRef(spots);
    const [openPopup, setOpenPopup] = useState(null); // { spotId, container, popup }

    const spotsById = useMemo(() => new Map(spots.map((spot) => [spot.id, spot])), [spots]);

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
                marker.setIcon(bubble ? getSingleSpotClusterIcon() : getSpotIcon(marker.options.spotType));
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
                    const marker = createSpotMarker(spot, offset, getSpotIcon(spot.spotType));
                    looseMarkersRef.current.set(key, marker);
                    loose.addLayer(marker);
                }
            });
        }
    }, [map]);

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
                return L.divIcon({
                    html: `<div class="spot-cluster-label">+${count}</div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(42, 42),
                });
            },
        });
        const loose = L.featureGroup();

        const onPopupOpen = (e) => {
            const marker = e.propagatedFrom;
            const container = popupContainers.get(marker);
            if (container) setOpenPopup({ spotId: marker.options.spotId, container, popup: e.popup });
        };
        const onPopupClose = () => setOpenPopup(null);
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

        clusterRef.current = cluster;
        looseRef.current = loose;
        modeRef.current = 'cluster';
        signatureRef.current = '';
        loadingRef.current = false;
        map.addLayer(cluster);

        return () => {
            clearTimeout(timer);
            map.off('moveend zoomend', scheduleEvaluate);
            // Si aún queda una carga por bloques en marcha, que no intente añadir a un mapa sin capa
            cluster._addLayer = () => {};
            map.removeLayer(cluster);
            map.removeLayer(loose);
            clusterRef.current = null;
            looseRef.current = null;
        };
    }, [map, evaluateMode]);

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
                const marker = createSpotMarker(
                    spot,
                    offset,
                    bubble ? getSingleSpotClusterIcon() : getSpotIcon(spot.spotType)
                );
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
    }, [map, spots, evaluateMode]);

    // 3. El contenido del popup (React) cambia de tamaño: avisamos a Leaflet para recolocarlo
    useEffect(() => {
        if (!openPopup) return;
        const observer = new ResizeObserver(() => openPopup.popup.update());
        observer.observe(openPopup.container);
        return () => observer.disconnect();
    }, [openPopup]);

    const currentSpot = openPopup ? spotsById.get(openPopup.spotId) : null;
    return currentSpot
        ? createPortal(<SpotPopup spot={currentSpot} onUpdate={onUpdate} />, openPopup.container)
        : null;
}

// COMPONENTE POPUP 
function SpotPopup({ spot, onUpdate }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myRating, setMyRating] = useState(0);        
    const [hasVoted, setHasVoted] = useState(false);     
    const [hoverRating, setHoverRating] = useState(0);   
    const [currentRating, setCurrentRating] = useState(0); 
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const imageUrl = spot.mediaUrl ? spot.mediaUrl : 'https://skateism.com/wp-content/uploads/2019/02/placeholder-skate.jpg';

    useEffect(() => {
        const loadSpotDetails = async () => {
            try {
                try {
                    const ratingRes = await api.get(`/ratings/check/${spot.id}`);
                    if (ratingRes.data && ratingRes.data.value > 0) {
                        setMyRating(ratingRes.data.value);
                        setHasVoted(true);
                    }
                } catch (e) { }

                try {
                    const commentsRes = await api.get(`/comments/spot/${spot.id}`);
                    setComments(commentsRes.data);
                } catch (e) { }

            } finally {
                setLoadingData(false);
            }
        };
        loadSpotDetails();
    }, [spot.id]);

    const handleSendReview = async () => {
        if (!user) {
            navigate('/login');
            return;
        }

        setIsSubmitting(true); 
        try {
            await api.post(`/ratings/${spot.id}`, { value: currentRating });
            if (newComment.trim().length > 0) {
                await api.post(`/comments/${spot.id}`, { content: newComment });
            }
            setHasVoted(true);
            setMyRating(currentRating);
            const updatedComments = await api.get(`/comments/spot/${spot.id}`);
            setComments(updatedComments.data);
            setShowComments(true); 
            if (onUpdate) onUpdate(); 
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data;
            alert(typeof errorMsg === 'string' ? errorMsg : "Error al enviar. ¿Estás logueado?");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) return <div style={{padding:'10px'}}>Cargando...</div>;

    return (
        <div style={{ width: '260px', fontFamily: 'Segoe UI, sans-serif' }}>
            
            {/* IMAGEN DEL SPOT */}
            <img 
              src={imageUrl} 
              alt={spot.name} 
              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px 8px 0 0', marginBottom: '10px' }}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Sin+Imagen' }}
            />

            {/* INFO HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '10px', padding: '0 10px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '18px' }}>{spot.name}</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>{spot.description}</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#f0f2f5', color: '#555', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #ddd' }}>
                        {spot.spotType}
                    </span>
                    <span style={{ background: '#e3f2fd', color: '#0984e3', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #74b9ff' }}>
                        {difficultyLabels[spot.difficultyLevel] || spot.difficultyLevel}
                    </span>
                    <span style={{ background: '#fff9c4', color: '#fbc531', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f9ca24' }}>
                        ⭐ {spot.surfaceRating ? spot.surfaceRating.toFixed(1) : '-'}
                    </span>
                </div>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />

            {/* ESTRELLAS */}
            <div style={{ textAlign: 'center', marginBottom: '10px', padding: '0 10px' }}>
                {hasVoted ? (
                    <div>
                        <p style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: 'bold', color: '#2ed573' }}>✅ Tu voto:</p>
                        <div style={{ fontSize: '26px', color: '#f1c40f', lineHeight: 1 }}>{'★'.repeat(myRating)}{'☆'.repeat(5 - myRating)}</div>
                    </div>
                ) : (
                    <div>
                        <p style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: 'bold', color: '#888' }}>Valora este spot:</p>
                        <div style={{ fontSize: '26px', cursor: 'pointer', lineHeight: 1 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} onClick={() => user ? setCurrentRating(star) : navigate('/login')} style={{ color: star <= (hoverRating || currentRating) ? '#f1c40f' : '#e0e0e0', transition: 'color 0.2s' }}>★</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* FORMULARIO */}
            {!hasVoted && currentRating > 0 && (
                <div style={{ animation: 'fadeIn 0.3s', padding: '0 10px' }}>
                    <textarea
                        placeholder="Escribe tu opinión (opcional)..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        style={{ width: '100%', height: '60px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', resize: 'none', marginBottom: '8px', background: '#ffffff', color: '#333333', boxSizing: 'border-box' }}
                    />
                    <button
                        onClick={handleSendReview}
                        disabled={isSubmitting}
                        className="map-popup-primary"
                    >
                        {isSubmitting ? 'Enviando...' : 'Enviar Reseña'}
                    </button>
                    {!user && (
                        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                            Inicia sesión para publicar tu reseña.
                        </p>
                    )}
                </div>
            )}

            <div style={{ padding: '0 10px', marginTop: '10px' }}>
                <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`, '_blank')}
                    className="map-popup-nav"
                >
                    <span style={{ fontSize: '16px' }}>🗺️</span> Cómo llegar
                </button>
            </div>

            {/* COMENTARIOS */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee', padding: '0 10px 10px 10px' }}>
                <button 
                    onClick={() => setShowComments(!showComments)}
                    className="map-popup-link"
                >
                    {showComments ? 'Ocultar comentarios ▲' : `Ver ${comments.length} comentarios ▼`}
                </button>

                {showComments && (
                    <div style={{ marginTop: '10px', maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                        {comments.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic', textAlign: 'center' }}>Sé el primero en comentar 🛹</p>
                        ) : (
                            comments.map((c, i) => (
                                <div key={i} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <strong style={{ color: '#333', fontSize: '12px' }}>{c.username}</strong>
                                        {c.rating > 0 && <span style={{ color: '#f1c40f', fontSize: '10px' }}>{'★'.repeat(c.rating)}</span>}
                                    </div>
                                    <p style={{ margin: 0, color: '#555', fontSize: '12px', lineHeight: '1.4' }}>{c.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
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

// BOTÓN GEOLOCALIZACIÓN
function LocationButton({ setMyPosition }) {
    const map = useMap();
    const buttonRef = useRef(null);
    const [message, setMessage] = useState(null);

    // Evita que los clics/arrastres sobre el botón lleguen al mapa
    useEffect(() => {
        if (buttonRef.current) {
            L.DomEvent.disableClickPropagation(buttonRef.current);
        }
    }, []);

    const showMessage = (text) => {
        setMessage(text);
        setTimeout(() => setMessage(null), 4000);
    };

    const goToMyLocation = () => {
        if (!navigator.geolocation) {
            showMessage('Tu navegador no soporta geolocalización');
            return;
        }
        setMessage('Obteniendo tu ubicación...');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
                setMyPosition(latlng);
                map.flyTo(latlng, 15);
                setMessage(null);
            },
            (err) => {
                console.error('Error de geolocalización:', err);
                showMessage(err.code === 1
                    ? 'Permiso de ubicación denegado. Actívalo en el navegador.'
                    : 'No se pudo obtener tu ubicación.');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
        );
    };

    return (
        <>
            {message && <div className="map-toast">{message}</div>}
            <button ref={buttonRef} onClick={goToMyLocation} className="map-location-btn" title="Mi Ubicación" aria-label="Centrar en mi ubicación">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
            </button>
        </>
    );
}

export default function MapPage() {
  const [spots, setSpots] = useState([]);
  const [myPosition, setMyPosition] = useState(null);
  
  // Estados de Filtros
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filters, setFilters] = useState({ spotType: 'ALL', minRating: 0, maxDistance: 0 });

  const { logout, user } = useAuth();
  const navigate = useNavigate(); 
  const pamplonaCenter = [42.8125, -1.6458]; 

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchSpots(); }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchSpots();
    setRefreshing(false);
  };
  
  const fetchSpots = useCallback(async () => { 
    try { 
      const response = await api.get('/spots'); 
      setSpots(response.data); 
    } catch (error) { 
      console.error("Error cargando spots:", error); 
    } 
  }, []);

  // LÓGICA DE FILTRADO (Haversine Formula)
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredSpots = useMemo(() => spots.filter(spot => {
    if (filters.spotType !== 'ALL' && spot.spotType !== filters.spotType) return false;
    if (filters.minRating > 0 && (spot.surfaceRating || 0) < filters.minRating) return false;
    if (filters.maxDistance > 0 && myPosition) {
      const distance = getDistanceFromLatLonInKm(myPosition.lat, myPosition.lng, spot.latitude, spot.longitude);
      if (distance > filters.maxDistance) return false;
    }
    return true;
  }), [spots, filters, myPosition]);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', margin: 0, padding: 0, overflow: 'hidden' }}>
      
      {/* ESTILOS GLOBALES */}
      <style>{`
        .leaflet-popup-content-wrapper { padding: 0 !important; overflow: hidden; border-radius: 12px !important; }
        .leaflet-popup-content { margin: 0 !important; width: 260px !important; }
        .leaflet-popup-tip-container { margin-top: -1px; }
      `}</style>

      {/* BOTÓN DE FILTROS (Arriba Izquierda) */}
      <button
        onClick={() => setShowFilterMenu(!showFilterMenu)}
        className="map-chrome-btn"
      >
        ⚙️ {filters.spotType !== 'ALL' || filters.minRating > 0 || filters.maxDistance > 0 ? 'Filtros (Activo)' : 'Filtros'}
      </button>

      {/* MENÚ DESPLEGABLE DE FILTROS */}
      {showFilterMenu && (
        <div className="map-filter-panel">
          <div className="map-filter-header">
            <h3>⚙️ Filtrar Spots</h3>
            <button onClick={() => setShowFilterMenu(false)} className="map-filter-close">✕</button>
          </div>

          <div className="map-filter-section">
            <strong>Tipo de Spot</strong>
            <div className="map-filter-pills">
              {['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'].map(type => (
                <span
                  key={type}
                  onClick={() => setFilters({...filters, spotType: type})}
                  className={`map-filter-pill${filters.spotType === type ? ' active' : ''}`}
                >
                  {type === 'ALL' ? 'Todos' : type}
                </span>
              ))}
            </div>
          </div>

          <div className="map-filter-section">
            <strong>Distancia Máxima (Requiere GPS)</strong>
            <div className="map-filter-pills">
              {[{l: 'Cualquiera', v: 0}, {l: '< 1 km', v: 1}, {l: '< 5 km', v: 5}, {l: '< 10 km', v: 10}].map(d => (
                <span
                  key={d.v}
                  onClick={() => { if(myPosition || d.v === 0) setFilters({...filters, maxDistance: d.v}) }}
                  className={`map-filter-pill${filters.maxDistance === d.v ? ' active' : ''}${(!myPosition && d.v > 0) ? ' disabled' : ''}`}
                >
                  {d.l}
                </span>
              ))}
            </div>
            {!myPosition && <small className="map-filter-hint">* Toca el botón 📍 del mapa para usar el GPS</small>}
          </div>

          <div className="map-filter-section">
            <strong>Estrellas Mínimas</strong>
            <div className="map-filter-pills">
              {[0, 1, 2, 3, 4, 5].map(r => (
                <span
                  key={r}
                  onClick={() => setFilters({...filters, minRating: r})}
                  className={`map-filter-pill${filters.minRating === r ? ' active' : ''}`}
                >
                  {r === 0 ? 'Todas' : `${r} ★`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEADER DE USUARIO Y BOTÓN ADMIN */}
      <div className="map-chrome-chip">
        {user ? (
          <>
            <span className="map-chip-user">👤 {user.username || user}</span>
            {(user.username === 'a' || user === 'a') && (
              <>
                <div className="map-chip-divider"></div>
                <button onClick={() => navigate('/admin')} className="map-chip-admin">
                  🛡️ Admin
                </button>
              </>
            )}
            <div className="map-chip-divider"></div>
            <button onClick={logout} className="map-chip-logout">Salir</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/login')} className="map-chip-ghost">Entrar</button>
            <button onClick={() => navigate('/register')} className="map-chip-primary">Registrarse</button>
          </>
        )}
      </div>

      {/* BOTÓN RECARGAR SPOTS (Abajo Izquierda) */}
      <button
        onClick={handleRefresh}
        className={`map-refresh-btn${refreshing ? ' spinning' : ''}`}
        title="Recargar spots"
        aria-label="Recargar spots"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 4v5h-5" />
        </svg>
      </button>

      <MapContainer
        center={pamplonaCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        maxBounds={[[-85.0511, -Infinity], [85.0511, Infinity]]}
        maxBoundsViscosity={1.0}
        worldCopyJump
      >
        <ZoomLimit />
        <PrerenderedTiles />
        
        <LocationButton setMyPosition={setMyPosition} />
        
        <DynamicSpotLayer spots={filteredSpots} onUpdate={fetchSpots} />
        
        {myPosition && <CircleMarker center={[myPosition.lat, myPosition.lng]} radius={8} pathOptions={{ color: 'white', fillColor: '#2980b9', fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
}