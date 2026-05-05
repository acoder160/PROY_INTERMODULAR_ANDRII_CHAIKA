import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as Location from 'expo-location';
import { View, Text, ActivityIndicator } from 'react-native';

// Solución al icono de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

// Componente para cambiar el centro dinámicamente
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

export default function SkateMap() {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fallbackPosition: [number, number] = [42.8125, -1.6458]; // Pamplona, si ubicacion falla

  useEffect(() => {
    // ✅ INYECTAMOS EL CSS DE LEAFLET DESDE UN CDN
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Lógica de geolocalización
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setErrorMsg('Permiso de ubicación denegado. Usando ubicación por defecto.');
          setLocation(fallbackPosition);
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation([currentLocation.coords.latitude, currentLocation.coords.longitude]);
      } catch (error) {
        setErrorMsg('No se pudo obtener la ubicación. Usando ubicación por defecto.');
        setLocation(fallbackPosition);
      }
    })();
  }, []);

  if (!location) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e5e5' }}>
        <ActivityIndicator size="large" color="#2EC4B6" />
        <Text style={{ marginTop: 10, color: '#6C757D' }}>Buscando tu ubicación...</Text>
      </View>
    );
  }

  return (
    <>
      {errorMsg && (
        <View style={{ backgroundColor: '#FF9F1C', padding: 10, zIndex: 10 }}>
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 12 }}>{errorMsg}</Text>
        </View>
      )}

      <MapContainer 
        center={location} 
        zoom={14} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapUpdater center={location} />
        
        <Marker position={location}>
          <Popup>
            {errorMsg ? "Ubicación aproximada (Respaldo)" : "¡Estás aquí!"}
          </Popup>
        </Marker>
      </MapContainer>
    </>
  );
}