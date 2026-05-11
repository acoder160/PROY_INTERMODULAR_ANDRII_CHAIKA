import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SkateMap from '../../components/skatemap';
import SpotFormModal from '../../components/SpotFormModal';
import CameraOverlay from '../../components/CameraOverlay';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { Redirect } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from '../../constants/api';
import { useLocation } from '../../hooks/useLocation';
import { useSpots } from '../../hooks/useSpots';
import SpotDetailsModal from '../../components/SpotDetailsModal';

export default function HomeScreen() {
  const { user, token, logout } = useAuth(); 
  
  const { spots, fetchSpots } = useSpots(token);
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
  
  // 🟢 ESTADO PARA SABER QUÉ SPOT ESTÁ SELECCIONADO (PARA EL POPUP DE DETALLES)
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);

  useEffect(() => { 
    fetchSpots(); 
    handleRecenter(true, setStatusMessage); 
  }, [token, fetchSpots]);

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
      finalImageUrl = await uploadImageToCloudinary(capturedPhoto, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET);
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
    } catch (error) { alert('Error al guardar el spot'); } finally { setIsUploading(false); }
  };

  if (!user) return <Redirect href="/login" />;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      
      <View style={styles.mapContainer}>
        <SkateMap 
          spots={spots} 
          userLocation={userLocation} 
          isAddingMode={isAddingMode} 
          onMapClick={(lat, lng) => { setNewSpotLocation({lat, lng}); setModalVisible(true); }}
          // 🟢 ESCUCHAMOS EL CLIC EN UN SPOT PARA ABRIR LOS DETALLES
          onSpotClick={(spotId) => {
             const spot = spots.find((s: any) => s.id === spotId);
             if (spot) setSelectedSpot(spot);
          }}
        />
      </View>

      <View style={styles.userBadge}>
        <Text style={styles.userName}>👤 {user}</Text>
        <View style={styles.separator} />
        <TouchableOpacity onPress={logout}><Text style={styles.logoutText}>Salir</Text></TouchableOpacity>
      </View>

      {(statusMessage || (isAddingMode && !newSpotLocation)) && (
        <View style={styles.addingNotice}>
          <Text style={styles.addingNoticeText}>{statusMessage || 'Toca dentro del círculo azul para ubicar 👇'}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.recenterButton} onPress={() => handleRecenter(false, setStatusMessage)}>
        <Text style={styles.iconText}>🎯</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.fab, isAddingMode ? styles.fabClose : styles.fabAdd]} onPress={startAddingProcess}>
        {isAddingMode ? <Text style={styles.fabIcon}>✕</Text> : <><Text style={styles.fabIcon}>➕</Text><Text style={styles.fabText}>Añadir Spot</Text></>}
      </TouchableOpacity>

      <SpotFormModal 
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setIsAddingMode(false); setCapturedPhoto(null); setStatusMessage(null); }}
        onSave={handleSaveSpot}
        formData={formData}
        setFormData={setFormData}
        capturedPhoto={capturedPhoto}
        isUploading={isUploading}
      />

      {/* 🟢 NUEVO MODAL DE DETALLES, COMENTARIOS Y VALORACIÓN */}
      <SpotDetailsModal 
        visible={!!selectedSpot} 
        spot={selectedSpot} 
        token={token}
        onClose={() => setSelectedSpot(null)} 
        onSpotUpdated={() => { fetchSpots(); }}
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
  userBadge: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4, zIndex: 10 },
  userName: { fontWeight: 'bold', color: '#1A1A1A', marginRight: 10 },
  separator: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginRight: 10 },
  logoutText: { color: '#ff6b6b', fontWeight: 'bold' },
  addingNotice: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, zIndex: 10 },
  addingNoticeText: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  recenterButton: { position: 'absolute', right: 20, bottom: 35, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5, zIndex: 10 },
  iconText: { fontSize: 24 },
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, zIndex: 10 },
  fabIcon: { fontSize: 20, marginRight: 8, color: 'white', fontWeight: 'bold' },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  fabAdd: { backgroundColor: '#2ed573', flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30 },
  fabClose: { backgroundColor: '#ff4757', width: 60, height: 60, borderRadius: 30 }
});