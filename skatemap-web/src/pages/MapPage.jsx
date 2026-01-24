import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

// --- ARREGLO DE ICONOS ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- COMPONENTE: CLICS EN EL MAPA ---
function MapClickHandler({ isAddingMode, onLocationSelect }) {
    useMapEvents({
        click(e) {
            if (isAddingMode) {
                onLocationSelect(e.latlng);
            }
        },
    });
    return null;
}

// --- COMPONENTE: BOTÓN GPS (Alineado abajo a la derecha) ---
function LocationButton() {
    const map = useMap();
    
    const goToMyLocation = () => {
        map.locate().on("locationfound", function (e) {
            map.flyTo(e.latlng, 15);
        });
    };

    return (
        <button 
            onClick={goToMyLocation}
            style={{
                position: 'absolute', 
                bottom: '30px', // MISMA ALTURA QUE EL BOTÓN CENTRAL
                right: '20px', 
                zIndex: 1000,
                background: 'white', 
                border: 'none', 
                borderRadius: '50%', 
                width: '50px', 
                height: '50px', 
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 0,
                fontSize: '24px',
                color: '#333'
            }}
            title="Mi Ubicación"
        >
            📍
        </button>
    );
}

// --- PÁGINA PRINCIPAL ---
export default function MapPage() {
  const [spots, setSpots] = useState([]);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState(null);
  
  // Formulario
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'BEGINNER' });

  const { logout, user } = useAuth();
  const defaultCenter = [40.4167, -3.7037]; 

  useEffect(() => {
    fetchSpots();
  }, []);

  const fetchSpots = async () => {
    try {
      const response = await api.get('/spots');
      setSpots(response.data);
    } catch (error) {
      console.error("Error cargando spots", error);
    }
  };

  const handleSaveSpot = async (e) => {
    e.preventDefault();
    if (!newSpotLocation) return;

    const payload = { ...formData, latitude: newSpotLocation.lat, longitude: newSpotLocation.lng };

    try {
        await api.post('/spots', payload);
        alert('¡Spot creado! 🛹');
        setIsAddingMode(false);
        setNewSpotLocation(null);
        setFormData({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'BEGINNER' });
        fetchSpots();
    } catch (error) {
        console.error(error);
        alert('Error al crear spot');
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', margin: 0, padding: 0, overflow: 'hidden' }}>
      
      {/* 1. BARRA SUPERIOR (Usuario y Salir) */}
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: 'rgba(255, 255, 255, 0.95)', padding: '8px 20px',
        borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '15px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: '500', color: '#333'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            👤 {user?.username}
        </span>
        <div style={{ width: '1px', height: '20px', background: '#ccc' }}></div>
        <button 
          onClick={logout} 
          style={{ 
            background: 'transparent', border: 'none', color: '#ff6b6b', 
            fontWeight: 'bold', padding: 0, fontSize: '14px' 
          }}
        >
          Salir
        </button>
      </div>

      {/* 2. BOTÓN "AÑADIR SPOT" (Cambia de forma según el estado) */}
      <button 
        onClick={() => { setIsAddingMode(!isAddingMode); setNewSpotLocation(null); }}
        style={{
            position: 'absolute', 
            bottom: '30px', 
            left: '50%', 
            transform: 'translateX(-50%)',
            zIndex: 1000,
            // Si estamos añadiendo, es círculo (50px). Si no, es botón ancho (auto)
            width: isAddingMode ? '50px' : 'auto', 
            height: '50px', 
            borderRadius: isAddingMode ? '50%' : '30px', // Círculo vs Píldora
            padding: isAddingMode ? '0' : '0 25px',      // Sin padding en círculo
            border: 'none',
            background: isAddingMode ? '#ff4757' : '#2ed573', 
            color: 'white', 
            fontSize: isAddingMode ? '24px' : '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', // Animación suave
            whiteSpace: 'nowrap' // Evita que el texto salte
        }}
      >
          {isAddingMode ? '✕' : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>➕</span> 
                <span>Añadir Spot</span>
            </div>
          )}
      </button>

      {/* Instrucciones Flotantes */}
      {isAddingMode && !newSpotLocation && (
          <div style={{
              position: 'absolute', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 15px',
              borderRadius: '20px', fontSize: '14px', pointerEvents: 'none'
          }}>
              Toca el mapa para ubicar 👇
          </div>
      )}

      {/* 3. FORMULARIO FLOTANTE */}
      {isAddingMode && newSpotLocation && (
          <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '85%', maxWidth: '320px', background: 'white', padding: '20px', 
              borderRadius: '20px', zIndex: 1002, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              textAlign: 'center'
          }}>
              <h3 style={{ marginTop: 0, color: '#333' }}>Nuevo Spot 📍</h3>
              <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', color: '#333' }}
                    placeholder="Nombre del Spot" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required 
                  />
                  <textarea 
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9', color: '#333', minHeight: '60px', resize: 'none' }}
                    placeholder="Descripción..." 
                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required 
                  />
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <select 
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333' }}
                        value={formData.spotType} onChange={e => setFormData({...formData, spotType: e.target.value})}
                      >
                          <option value="STREET">Calle</option>
                          <option value="PARK">Park</option>
                          <option value="DIY">DIY</option>
                      </select>

                      <select 
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333' }}
                        value={formData.difficultyLevel} onChange={e => setFormData({...formData, difficultyLevel: e.target.value})}
                      >
                          <option value="BEGINNER">Fácil</option>
                          <option value="INTERMEDIATE">Medio</option>
                          <option value="ADVANCED">Pro</option>
                      </select>
                  </div>

                  <button type="submit" style={{ background: '#2ed573', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', marginTop: '10px' }}>
                    Guardar Spot
                  </button>
              </form>
          </div>
      )}

      {/* 4. EL MAPA */}
      <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapClickHandler isAddingMode={isAddingMode} onLocationSelect={setNewSpotLocation} />
        <LocationButton />

        {spots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]}>
            <Popup>
              <strong>{spot.name}</strong><br/>
              {spot.spotType} - ⭐ {spot.surfaceRating || 'N/A'}
            </Popup>
          </Marker>
        ))}

        {newSpotLocation && (
            <Marker position={newSpotLocation} opacity={0.7}></Marker>
        )}
      </MapContainer>
    </div>
  );
}