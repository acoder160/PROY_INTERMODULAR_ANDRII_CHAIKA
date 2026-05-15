import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom'; 

const getSpotIcon = (type) => {
    let iconPath = '/icons/icon_street.png'; // Por defecto
    switch (type) {
        case 'STREET': iconPath = '/icons/icon_street.png'; break;
        case 'PARK':   
        case 'SKATEPARK': iconPath = '/icons/icon_park.png'; break;
        case 'RAMPS':  iconPath = '/icons/icon_ramps.png'; break;
        case 'RAIL':   iconPath = '/icons/icon_rail.png'; break;
        case 'LEDGE':  iconPath = '/icons/icon_ledge.png'; break;
    }
    
    return L.icon({
        iconUrl: iconPath,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -40]
    });
};

//  DICCIONARIO PARA TRADUCIR DIFICULTAD 
const difficultyLabels = {
    'BEGINNER': 'Fácil',
    'INTERMEDIATE': 'Medio',
    'ADVANCED': 'Pro'
};

// COMPONENTE POPUP 
function SpotPopup({ spot, onUpdate }) {
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
                                <span key={star} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} onClick={() => setCurrentRating(star)} style={{ color: star <= (hoverRating || currentRating) ? '#f1c40f' : '#e0e0e0', transition: 'color 0.2s' }}>★</span>
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
                        style={{ width: '100%', padding: '10px', background: '#2ed573', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(46, 213, 115, 0.3)' }}
                    >
                        {isSubmitting ? 'Enviando...' : 'Enviar Reseña'}
                    </button>
                </div>
            )}

            <div style={{ padding: '0 10px', marginTop: '10px' }}>
                <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`, '_blank')}
                    style={{ width: '100%', padding: '10px', background: '#0984e3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                    <span style={{ fontSize: '16px' }}>🗺️</span> Cómo llegar
                </button>
            </div>

            {/* COMENTARIOS */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee', padding: '0 10px 10px 10px' }}>
                <button 
                    onClick={() => setShowComments(!showComments)}
                    style={{ width: '100%', background: 'none', border: 'none', color: '#0984e3', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
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

// BOTÓN GEOLOCALIZACIÓN
function LocationButton({ setMyPosition }) {
    const map = useMap();
    const goToMyLocation = () => { map.locate().on("locationfound", function (e) { setMyPosition(e.latlng); map.flyTo(e.latlng, 15); }); };
    return <button onClick={goToMyLocation} style={{ position: 'absolute', bottom: '30px', right: '20px', zIndex: 1000, background: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0, fontSize: '24px', color: '#333' }} title="Mi Ubicación">📍</button>;
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

  useEffect(() => { fetchSpots(); }, []);
  
  const fetchSpots = async () => { 
    try { 
      const response = await api.get('/spots'); 
      setSpots(response.data); 
    } catch (error) { 
      console.error("Error cargando spots:", error); 
    } 
  };

  // LÓGICA DE FILTRADO (Haversine Formula)
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredSpots = spots.filter(spot => {
    if (filters.spotType !== 'ALL' && spot.spotType !== filters.spotType) return false;
    if (filters.minRating > 0 && (spot.surfaceRating || 0) < filters.minRating) return false;
    if (filters.maxDistance > 0 && myPosition) {
      const distance = getDistanceFromLatLonInKm(myPosition.lat, myPosition.lng, spot.latitude, spot.longitude);
      if (distance > filters.maxDistance) return false;
    }
    return true;
  });

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
        style={{
          position: 'absolute', top: '20px', left: '20px', zIndex: 1000, 
          background: 'white', border: 'none', padding: '10px 20px', 
          borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
          fontWeight: 'bold', color: '#333', cursor: 'pointer'
        }}
      >
        ⚙️ {filters.spotType !== 'ALL' || filters.minRating > 0 || filters.maxDistance > 0 ? 'Filtros (Activo)' : 'Filtros'}
      </button>

      {/* MENÚ DESPLEGABLE DE FILTROS */}
      {showFilterMenu && (
        <div style={{
          position: 'absolute', top: '70px', left: '20px', zIndex: 1000,
          background: 'white', padding: '20px', borderRadius: '15px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: '280px',
          fontFamily: 'Segoe UI, sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1A1A1A' }}>⚙️ Filtrar Spots</h3>
            <button onClick={() => setShowFilterMenu(false)} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>Tipo de Spot</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'].map(type => (
                <span 
                  key={type} 
                  onClick={() => setFilters({...filters, spotType: type})}
                  style={{ 
                    padding: '6px 12px', borderRadius: '15px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                    background: filters.spotType === type ? '#2EC4B6' : '#f0f0f0',
                    color: filters.spotType === type ? 'white' : '#666'
                  }}
                >
                  {type === 'ALL' ? 'Todos' : type}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>Distancia Máxima (Requiere GPS)</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[{l: 'Cualquiera', v: 0}, {l: '< 1 km', v: 1}, {l: '< 5 km', v: 5}, {l: '< 10 km', v: 10}].map(d => (
                <span 
                  key={d.v}
                  onClick={() => { if(myPosition || d.v === 0) setFilters({...filters, maxDistance: d.v}) }}
                  style={{ 
                    padding: '6px 12px', borderRadius: '15px', fontSize: '12px', cursor: (!myPosition && d.v > 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold',
                    background: filters.maxDistance === d.v ? '#007AFF' : '#f0f0f0',
                    color: filters.maxDistance === d.v ? 'white' : '#666',
                    opacity: (!myPosition && d.v > 0) ? 0.5 : 1
                  }}
                >
                  {d.l}
                </span>
              ))}
            </div>
            {!myPosition && <small style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '5px', display: 'block' }}>* Toca el botón 📍 del mapa para usar el GPS</small>}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>Estrellas Mínimas</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[0, 1, 2, 3, 4, 5].map(r => (
                <span 
                  key={r}
                  onClick={() => setFilters({...filters, minRating: r})}
                  style={{ 
                    padding: '6px 12px', borderRadius: '15px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                    background: filters.minRating === r ? '#FF9F1C' : '#f0f0f0',
                    color: filters.minRating === r ? 'white' : '#666'
                  }}
                >
                  {r === 0 ? 'Todas' : `${r} ★`}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* HEADER DE USUARIO Y BOTÓN ADMIN (Vuelto al Centro) */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '50%',                  
        transform: 'translateX(-50%)', // restamos su propio ancho para centrarlo exacto
        zIndex: 1000, 
        background: 'rgba(255, 255, 255, 0.95)', 
        padding: '8px 20px', 
        borderRadius: '30px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px', 
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
        fontWeight: '500', 
        color: '#333',
        whiteSpace: 'nowrap'          // Evita que el nombre se parta en dos líneas
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>👤 {user?.username || user}</span>
        
        {/* BOTÓN PANEL ADMIN */}
        {(user === 'a' || user?.username === 'a') && (
           <>
             <div style={{ width: '1px', height: '20px', background: '#ccc' }}></div>
             <button onClick={() => navigate('/admin')} style={{ background: '#2f3542', border: 'none', color: 'white', fontWeight: 'bold', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', cursor: 'pointer' }}>
               🛡️ Admin
             </button>
           </>
        )}

        <div style={{ width: '1px', height: '20px', background: '#ccc' }}></div>
        <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', fontWeight: 'bold', padding: 0, fontSize: '14px', cursor: 'pointer' }}>Salir</button>
      </div>

      <MapContainer center={pamplonaCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        
        <LocationButton setMyPosition={setMyPosition} />
        
        {/* Dibujamos los spots filtrados */}
        {filteredSpots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={getSpotIcon(spot.spotType)}>
            <Popup><SpotPopup spot={spot} onUpdate={fetchSpots} /></Popup>
          </Marker>
        ))}
        
        {myPosition && <CircleMarker center={[myPosition.lat, myPosition.lng]} radius={8} pathOptions={{ color: 'white', fillColor: '#2980b9', fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
}