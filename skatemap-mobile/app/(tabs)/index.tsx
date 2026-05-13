import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SkateMap from '../../components/skatemap';
import SpotFormModal from '../../components/SpotFormModal';
import CameraOverlay from '../../components/CameraOverlay';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from '../../constants/api';
import { useLocation } from '../../hooks/useLocation';
import { useSpots } from '../../hooks/useSpots';
import SpotDetailsModal from '../../components/SpotDetailsModal';
import FilterModal from '../../components/FilterModal';

const reloadStaticPath = require('../../assets/images/reload_static.png');
const reloadAnimPath = require('../../assets/images/reload_anim.gif');

// Tiempo del GIF para completar un ciclo natural
const GIF_CYCLE_DURATION_MS = 2000; 

export default function HomeScreen() {
  const { user, token, logout } = useAuth(); 
  
  const { userLocation, handleRecenter } = useLocation();
  
  const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME; 
  const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<any>(null); 
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState<{lat: number, lng: number} | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
  
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { spots, fetchSpots, isOffline } = useSpots(token);

  // Estados para los filtros
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({ minRating: 0, spotType: 'ALL', maxDistance: 0 });

  // Lógica para recargar spots asegurando el ciclo del GIF
  const handleReloadSpots = async () => {
    if (!token || isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      const fetchPromise = fetchSpots();
      const animationPromise = new Promise(resolve => setTimeout(resolve, GIF_CYCLE_DURATION_MS));
      
      await Promise.all([fetchPromise, animationPromise]);
      
    } catch (error) {
      console.error("Error recargando spots:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      handleReloadSpots();
    }, [token, fetchSpots])
  );

  useEffect(() => { 
    handleRecenter(true, setStatusMessage); 
  }, [handleRecenter]);

  const startAddingProcess = async () => {
    if (isAddingMode) {
      setIsAddingMode(false); setNewSpotLocation(null); setCapturedPhoto(null); setStatusMessage(null); return;
    }

    setStatusMessage('📸 Preparando la cámara...');
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { setStatusMessage('⚠️ Permiso de cámara denegado'); setTimeout(() => setStatusMessage(null), 3000); return; }
    }
    
    let loc = userLocation;
    if (!loc) {
        setStatusMessage('⚠️ Esperando GPS...');
        loc = await handleRecenter(true, setStatusMessage);
        if(!loc) return; 
    }

    setStatusMessage(null);
    setShowCamera(true); 
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      setStatusMessage('📸 Procesando foto...');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setCapturedPhoto(photo.uri);
      setShowCamera(false);
      setIsAddingMode(true);
      setStatusMessage('📍 Toca dentro del círculo azul para ubicar 👇');
      handleRecenter(true, setStatusMessage); 
    }
  };

  const handleSaveSpot = async () => {
    if (!newSpotLocation || !formData.name || !capturedPhoto) { alert("Faltan datos o foto"); return; }
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) { alert("Error de configuración de Cloudinary"); return; }

    setIsUploading(true);
    let finalImageUrl = null;

    try {
      finalImageUrl = await uploadImageToCloudinary(capturedPhoto, token as string);
    } catch (error) {
      alert("Hubo un problema al subir la foto a la nube.");
      setIsUploading(false); return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/spots`, { 
        ...formData, latitude: newSpotLocation.lat, longitude: newSpotLocation.lng, mediaUrl: finalImageUrl
      }, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } });
      
      alert('¡Spot creado correctamente!');
      setModalVisible(false); setIsAddingMode(false); setNewSpotLocation(null); setCapturedPhoto(null); setStatusMessage(null);
      setFormData({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
      fetchSpots();
    } catch (error: any) { 
      const serverError = error.response?.data?.error; // Captura errores de Bucket4j
      const serverMessage = error.response?.data?.message; // Captura errores de IA o Validación
      
      const finalMsg = serverError || serverMessage || (typeof error.response?.data === 'string' ? error.response?.data : null);
      
      alert(finalMsg || 'Error al guardar el spot. Revisa tu conexión.'); 
    } finally { 
      setIsUploading(false); 
    }
  };

  // --- LÓGICA DE FILTRADO (Haversine Formula) ---
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredSpots = spots.filter((spot: any) => {
    // Filtro por tipo
    if (filters.spotType !== 'ALL' && spot.spotType !== filters.spotType && spot.type !== filters.spotType) return false;
    
    // Filtro por valoración (estrellas)
    if (filters.minRating > 0 && (spot.surfaceRating || 0) < filters.minRating) return false;

    // Filtro por distancia (si hay ubicación de usuario)
    if (filters.maxDistance > 0 && userLocation) {
      const distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude);
      if (distance > filters.maxDistance) return false;
    }

    return true;
  });

  if (!user) return <Redirect href="/login" />;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      
      <View style={styles.mapContainer}>
        <SkateMap 
          spots={filteredSpots} 
          userLocation={userLocation} 
          isAddingMode={isAddingMode} 
          onMapClick={(lat, lng) => { setNewSpotLocation({lat, lng}); setModalVisible(true); }}
          onSpotClick={(spotId) => {
             const spot = spots.find((s: any) => s.id === spotId);
             if (spot) setSelectedSpot(spot);
          }}
        />
      </View>

      {/* NUEVO: Botón de Filtros (Arriba a la izquierda) */}
      <TouchableOpacity 
        style={styles.filterButton} 
        onPress={() => setFilterModalVisible(true)}
      >
        <Text style={styles.filterBtnText}>
          {filters.spotType !== 'ALL' || filters.minRating > 0 || filters.maxDistance > 0 ? '⚙️ Filtros (Activo)' : '⚙️ Filtros'}
        </Text>
      </TouchableOpacity>

      {/* Botón Badge de Usuario (Centrado arriba) */}
      <View style={styles.userBadge}>
        <Text style={styles.userName}>👤 {user}</Text>
        <View style={styles.separator} />
        <TouchableOpacity onPress={logout}><Text style={styles.logoutText}>Salir</Text></TouchableOpacity>
      </View>

      {/* AVISO DE MODO OFFLINE */}
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>⚠️ Modo Offline (Mostrando mapa guardado)</Text>
        </View>
      )}

      {(statusMessage || (isAddingMode && !newSpotLocation)) && (
        <View style={styles.addingNotice}>
          <Text style={styles.addingNoticeText}>{statusMessage || 'Toca dentro del círculo azul para ubicar 👇'}</Text>
        </View>
      )}

      {/* Botón Reload Animado (Abajo a la izquierda) */}
      <TouchableOpacity 
        style={styles.refreshBadge} 
        onPress={handleReloadSpots}
        activeOpacity={0.8}
      >
        <Image 
          source={isRefreshing ? reloadAnimPath : reloadStaticPath} 
          style={styles.refreshIcon}
          resizeMode="contain" 
        />
      </TouchableOpacity>

      {/* Botón de Centrado GPS (Abajo a la derecha) */}
      <TouchableOpacity style={styles.recenterButton} onPress={() => handleRecenter(false, setStatusMessage)}>
        <Text style={styles.iconText}>📍</Text>
      </TouchableOpacity>

      {/* Botón Añadir Spot (Centro abajo) */}
      <TouchableOpacity style={[styles.fab, isAddingMode ? styles.fabClose : styles.fabAdd]} onPress={startAddingProcess}>
        {isAddingMode ? <Text style={styles.fabIcon}>✕</Text> : <><Text style={styles.fabIcon}>➕</Text><Text style={styles.fabText}>Añadir Spot</Text></>}
      </TouchableOpacity>

      {/* MODALES */}
      <SpotFormModal 
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setIsAddingMode(false); setCapturedPhoto(null); setStatusMessage(null); }}
        onSave={handleSaveSpot}
        formData={formData}
        setFormData={setFormData}
        capturedPhoto={capturedPhoto}
        isUploading={isUploading}
      />

      <SpotDetailsModal 
        visible={!!selectedSpot} 
        spot={selectedSpot} 
        token={token}
        onClose={() => setSelectedSpot(null)} 
        onSpotUpdated={() => { fetchSpots(); }}
      />

      <FilterModal 
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        setFilters={setFilters}
      />

      {showCamera && (
        <CameraOverlay cameraRef={cameraRef} onCapture={takePicture} onCancel={() => { setShowCamera(false); setStatusMessage(null); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: { ...StyleSheet.absoluteFillObject, elevation: 0 },
  
  // Estilos del botón de filtros
  filterButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  filterBtnText: {
    fontWeight: 'bold',
    color: '#1A1A1A'
  },

  // Badge de usuario centrado arriba
  userBadge: { 
    position: 'absolute', 
    top: 60, 
    right: 20, 
    backgroundColor: 'white', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 25, 
    shadowColor: '#000', 
    shadowOpacity: 0.15, 
    shadowRadius: 4, 
    elevation: 4, 
    zIndex: 10 
  },
  
  userName: { fontWeight: 'bold', color: '#1A1A1A', marginRight: 10 },
  separator: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginRight: 10 },
  logoutText: { color: '#ff6b6b', fontWeight: 'bold' },

  // Estilos del aviso de Modo Offline
  offlineBadge: {
    position: 'absolute',
    top: 115, 
    alignSelf: 'center',
    backgroundColor: '#ff9f1c',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  offlineText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: 'bold',
  },

  addingNotice: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, zIndex: 10 },
  addingNoticeText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  
  // Botón Reload (Abajo Izquierda)
  refreshBadge: { position: 'absolute', bottom: 35, left: 20, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5, zIndex: 10 },
  refreshIcon: { width: 30, height: 30 },
  
  // Botón GPS (Abajo Derecha)
  recenterButton: { position: 'absolute', right: 20, bottom: 35, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5, zIndex: 10 },
  iconText: { fontSize: 24 },
  
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, zIndex: 10 },
  fabIcon: { fontSize: 20, marginRight: 8, color: 'white', fontWeight: 'bold' },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  fabAdd: { backgroundColor: '#2ed573', flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30 },
  fabClose: { backgroundColor: '#ff4757', width: 60, height: 60, borderRadius: 30 }
});