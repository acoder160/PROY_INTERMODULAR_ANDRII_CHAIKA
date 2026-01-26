import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

// --- ICONOS ---
const getSpotIcon = (type) => {
    let emoji = '📍'; 
    switch (type) {
        case 'STREET': emoji = '🛹'; break;
        case 'PARK':   emoji = '🏟️'; break;
        case 'RAMPS':  emoji = '🏂'; break;
        case 'RAIL':   emoji = '🥖'; break;
        case 'LEDGE':  emoji = '🧱'; break;
        default:       emoji = '📍';
    }
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="font-size: 30px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">${emoji}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
};

// --- COMPONENTE POPUP ---
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
            alert("Error al enviar. ¿Estás logueado?");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingData) return <div style={{padding:'10px'}}>Cargando...</div>;

    return (
        <div style={{ minWidth: '240px', maxWidth: '280px', fontFamily: 'Segoe UI, sans-serif' }}>
            
            {/* INFO HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '18px' }}>{spot.name}</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>{spot.description}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ background: '#f0f2f5', color: '#555', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #ddd' }}>{spot.spotType}</span>
                    <span style={{ background: '#fff9c4', color: '#fbc531', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f9ca24' }}>⭐ {spot.surfaceRating || '-'}</span>
                </div>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />

            {/* ESTRELLAS */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
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

            {/* FORMULARIO (CORREGIDO FONDO BLANCO) */}
            {!hasVoted && currentRating > 0 && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <textarea
                        placeholder="Escribe tu opinión..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        style={{ 
                            width: '100%', 
                            height: '60px', 
                            padding: '10px', 
                            borderRadius: '8px', 
                            border: '1px solid #ccc', 
                            fontSize: '13px', 
                            resize: 'none', 
                            marginBottom: '8px',
                            background: '#ffffff', // FORZADO BLANCO
                            color: '#333333',      // TEXTO OSCURO
                            fontFamily: 'inherit'
                        }}
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

            {/* COMENTARIOS */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
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

// --- RESTO DE COMPONENTES ---
function MapClickHandler({ isAddingMode, onLocationSelect }) {
    useMapEvents({ click(e) { if (isAddingMode) onLocationSelect(e.latlng); } });
    return null;
}

function LocationButton({ setMyPosition }) {
    const map = useMap();
    const goToMyLocation = () => { map.locate().on("locationfound", function (e) { setMyPosition(e.latlng); map.flyTo(e.latlng, 15); }); };
    return <button onClick={goToMyLocation} style={{ position: 'absolute', bottom: '30px', right: '20px', zIndex: 1000, background: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0, fontSize: '24px', color: '#333' }} title="Mi Ubicación">📍</button>;
}

export default function MapPage() {
  const [spots, setSpots] = useState([]);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
  const { logout, user } = useAuth();
  const pamplonaCenter = [42.8125, -1.6458]; 

  useEffect(() => { fetchSpots(); }, []);
  const fetchSpots = async () => { try { const response = await api.get('/spots'); setSpots(response.data); } catch (error) { console.error("Error cargando spots:", error); } };

  const handleSaveSpot = async (e) => {
    e.preventDefault();
    if (!newSpotLocation) return;
    try { await api.post('/spots', { ...formData, latitude: newSpotLocation.lat, longitude: newSpotLocation.lng }); alert('¡Spot creado!'); setIsAddingMode(false); setNewSpotLocation(null); fetchSpots(); } catch (error) { alert('Error al crear spot'); }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', margin: 0, padding: 0, overflow: 'hidden' }}>
      
      {/* ESTILOS GLOBALES PARA ARREGLAR LEAFLET POPUP */}
      <style>{`
        /* Quitamos márgenes extraños del popup por defecto */
        .leaflet-popup-content { margin: 12px !important; width: auto !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px !important; padding: 0 !important; overflow: hidden; }
        /* Ajustamos el pico para que no se rompa */
        .leaflet-popup-tip-container { margin-top: -1px; }
      `}</style>

      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(255, 255, 255, 0.95)', padding: '8px 20px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: '500', color: '#333' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>👤 {user?.username}</span><div style={{ width: '1px', height: '20px', background: '#ccc' }}></div><button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', fontWeight: 'bold', padding: 0, fontSize: '14px' }}>Salir</button>
      </div>

      <button onClick={() => { setIsAddingMode(!isAddingMode); setNewSpotLocation(null); }} style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: isAddingMode ? '50px' : 'auto', height: '50px', borderRadius: isAddingMode ? '50%' : '30px', padding: isAddingMode ? '0' : '0 25px', border: 'none', background: isAddingMode ? '#ff4757' : '#2ed573', color: 'white', fontSize: isAddingMode ? '24px' : '16px', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', whiteSpace: 'nowrap' }}>
          {isAddingMode ? '✕' : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>➕</span> <span>Añadir Spot</span></div>}
      </button>

      {isAddingMode && !newSpotLocation && (<div style={{ position: 'absolute', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '14px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>Toca el mapa para ubicar 👇</div>)}

      {isAddingMode && newSpotLocation && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '85%', maxWidth: '320px', background: 'white', padding: '20px', borderRadius: '20px', zIndex: 1002, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0, color: '#333' }}>Nuevo Spot 📍</h3>
              <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', color: '#333' }} placeholder="Nombre" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  <textarea style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', color: '#333', minHeight: '60px', resize: 'none' }} placeholder="Descripción..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <select style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333' }} value={formData.spotType} onChange={e => setFormData({...formData, spotType: e.target.value})}><option value="STREET">Calle</option><option value="PARK">Skatepark</option><option value="RAMPS">Rampas</option><option value="RAIL">Barandilla</option><option value="LEDGE">Bordillo</option></select>
                      <select style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333' }} value={formData.difficultyLevel} onChange={e => setFormData({...formData, difficultyLevel: e.target.value})}><option value="BEGINNER">Fácil</option><option value="INTERMEDIATE">Medio</option><option value="ADVANCED">Pro</option></select>
                  </div>
                  <button type="submit" style={{ background: '#2ed573', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', marginTop: '10px' }}>Guardar Spot</button>
              </form>
          </div>
      )}

      <MapContainer center={pamplonaCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        <MapClickHandler isAddingMode={isAddingMode} onLocationSelect={setNewSpotLocation} />
        <LocationButton setMyPosition={setMyPosition} />
        {spots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={getSpotIcon(spot.spotType)}>
            <Popup><SpotPopup spot={spot} onUpdate={fetchSpots} /></Popup>
          </Marker>
        ))}
        {myPosition && <CircleMarker center={myPosition} radius={8} pathOptions={{ color: 'white', fillColor: '#2980b9', fillOpacity: 1 }} />}
        {newSpotLocation && <Marker position={newSpotLocation} opacity={0.7}></Marker>}
      </MapContainer>
    </div>
  );
}