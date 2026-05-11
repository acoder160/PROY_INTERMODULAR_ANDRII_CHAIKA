import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SkateMap from '../../components/skatemap';
import { Redirect } from 'expo-router';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_BASE_URL } from '../../constants/api';

export default function HomeScreen() {
  const [spots, setSpots] = useState([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const { user, token, logout } = useAuth(); 
  
  // 🔐 CONFIGURACIÓN DE CLOUDINARY (Leída de forma segura)
  const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME; 
  const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  // ESTADOS DE CÁMARA Y MENSAJES
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<any>(null); 
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ESTADOS DE CREACIÓN DE SPOT
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState<{lat: number, lng: number} | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });

  // 1. CARGAR SPOTS
  const fetchSpots = async () => {
    if (!token) return; 
    try {
      const response = await axios.get(`${API_BASE_URL}/api/spots`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } 
      });
      setSpots(response.data);
    } catch (error) { console.error("Error cargando spots:", error); }
  };

  useEffect(() => { fetchSpots(); handleRecenter(true); }, [token]);

  // 2. FUNCIÓN DE UBICACIÓN (Con parámetro silent corregido)
  const handleRecenter = async (silent = false) => {
    if (!silent) setStatusMessage('📍 Obteniendo tu ubicación actual...');
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) {
            setStatusMessage('⚠️ Permiso de GPS denegado');
            setTimeout(() => setStatusMessage(null), 3000);
        }
        return;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
      if (!silent) setStatusMessage(null);
    } catch (error) {
      console.warn("GPS falló...", error);
      let lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setUserLocation({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
        if (!silent) setStatusMessage(null);
      } else {
        if (!silent) {
            setStatusMessage('⚠️ Error buscando ubicación');
            setTimeout(() => setStatusMessage(null), 3000);
        }
      }
    }
  };

  // 3. FLUJO DE AÑADIR SPOT
  const startAddingProcess = async () => {
    if (isAddingMode) {
      setIsAddingMode(false);
      setNewSpotLocation(null);
      setCapturedPhoto(null);
      setStatusMessage(null);
      return;
    }

    setStatusMessage('📸 Preparando la cámara...');
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setStatusMessage('⚠️ Permiso de cámara denegado');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
    }
    
    await handleRecenter(true); // Ubicación silenciosa

    if (!userLocation) {
        setStatusMessage('⚠️ Esperando GPS...');
        // Intentamos una última vez antes de fallar
        await handleRecenter(true);
        if(!userLocation) {
            setTimeout(() => setStatusMessage(null), 3000);
            return;
        }
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
      handleRecenter(true); 
    }
  };

  // 4. GUARDAR SPOT (Con validación de .env)
  const handleSaveSpot = async () => {
    if (!newSpotLocation || !formData.name || !capturedPhoto) {
        alert("Faltan datos o foto");
        return;
    }
    
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        alert("Error de configuración: Claves de Cloudinary no encontradas en el .env");
        return;
    }

    setIsUploading(true);
    let finalImageUrl = null;

    try {
      const data = new FormData();
      data.append('file', { uri: capturedPhoto, type: 'image/jpeg', name: 'spot_image.jpg' } as any);
      data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      data.append('cloud_name', CLOUDINARY_CLOUD_NAME);

      const cloudinaryRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        data,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      finalImageUrl = cloudinaryRes.data.secure_url;
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al subir la foto a la nube.");
      setIsUploading(false);
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/spots`, { 
        ...formData, 
        latitude: newSpotLocation.lat, 
        longitude: newSpotLocation.lng,
        mediaUrl: finalImageUrl
      }, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      alert('¡Spot creado correctamente!');
      setModalVisible(false);
      setIsAddingMode(false);
      setNewSpotLocation(null);
      setCapturedPhoto(null);
      setStatusMessage(null);
      setFormData({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
      fetchSpots();
    } catch (error) {
      alert('Error al guardar el spot en la base de datos');
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return <Redirect href="/login" />;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      
      {/* MAPA */}
      <View style={styles.mapContainer}>
        <SkateMap 
          spots={spots} 
          userLocation={userLocation} 
          isAddingMode={isAddingMode}
          onMapClick={(lat: number, lng: number) => {
            setNewSpotLocation({lat, lng});
            setModalVisible(true);
          }}
        />
      </View>

      {/* HEADER USUARIO */}
      <View style={styles.userBadge}>
        <Text style={styles.userName}>👤 {user}</Text>
        <View style={styles.separator} />
        <TouchableOpacity onPress={logout}><Text style={styles.logoutText}>Salir</Text></TouchableOpacity>
      </View>

      {/* PANEL DE MENSAJES DINÁMICOS */}
      {(statusMessage || (isAddingMode && !newSpotLocation)) && (
        <View style={styles.addingNotice}>
          <Text style={styles.addingNoticeText}>
            {statusMessage || 'Toca dentro del círculo azul para ubicar 👇'}
          </Text>
        </View>
      )}

      {/* BOTÓN RECENTRAR */}
      <TouchableOpacity style={styles.recenterButton} onPress={() => handleRecenter(false)}>
        <Text style={styles.iconText}>🎯</Text>
      </TouchableOpacity>

      {/* BOTÓN FLOTANTE */}
      <TouchableOpacity 
        style={[styles.fab, isAddingMode ? styles.fabClose : styles.fabAdd]} 
        onPress={startAddingProcess}
      >
        {isAddingMode ? (
          <Text style={styles.fabIcon}>✕</Text>
        ) : (
          <>
            <Text style={styles.fabIcon}>➕</Text>
            <Text style={styles.fabText}>Añadir Spot</Text>
          </>
        )}
      </TouchableOpacity>

      {/* MODAL: FORMULARIO */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Spot 📍</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setIsAddingMode(false); setCapturedPhoto(null); setStatusMessage(null); }}>
                <Text style={styles.closeButtonText}>✕ Cancelar</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              
              {capturedPhoto && (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
                    <Text style={styles.previewText}>Foto capturada ✔️</Text>
                </View>
              )}

              <TextInput style={styles.input} placeholder="Nombre" value={formData.name} onChangeText={(text) => setFormData({...formData, name: text})} />
              <TextInput style={[styles.input, {height: 80}]} placeholder="Descripción..." multiline value={formData.description} onChangeText={(text) => setFormData({...formData, description: text})} />
              
              <View style={styles.selectRow}>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerLabel}>Tipo</Text>
                  <TouchableOpacity style={styles.pickerButton} onPress={() => setFormData({...formData, spotType: formData.spotType === 'STREET' ? 'PARK' : formData.spotType === 'PARK' ? 'RAIL' : formData.spotType === 'RAIL' ? 'LEDGE' : formData.spotType === 'LEDGE' ? 'RAMPS' : 'STREET'})}>
                    <Text>{formData.spotType}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.pickerBox}>
                  <Text style={styles.pickerLabel}>Nivel</Text>
                  <TouchableOpacity style={styles.pickerButton} onPress={() => setFormData({...formData, difficultyLevel: formData.difficultyLevel === 'BEGINNER' ? 'INTERMEDIATE' : formData.difficultyLevel === 'INTERMEDIATE' ? 'ADVANCED' : 'BEGINNER'})}>
                    <Text>{formData.difficultyLevel}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[styles.saveButton, isUploading && { opacity: 0.7 }]} onPress={handleSaveSpot} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Spot</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CÁMARA (Capa superior absoluta) */}
      {showCamera && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
          <CameraView style={{ flex: 1 }} ref={cameraRef} facing="back">
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraHeader}>
                <Text style={styles.cameraText}>Haz una foto del spot 🛹</Text>
              </View>
              <View style={styles.cameraFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCamera(false); setStatusMessage(null); }}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                  <View style={styles.captureBtnInner} />
                </TouchableOpacity>
                <View style={{width: 60}} />
              </View>
            </View>
          </CameraView>
        </View>
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
  fabClose: { backgroundColor: '#ff4757', width: 60, height: 60, borderRadius: 30 },
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  cameraHeader: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, paddingTop: 60, alignItems: 'center' },
  cameraText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  cameraFooter: { backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 30, paddingBottom: 50 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 20, overflow: 'hidden', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButtonText: { fontSize: 14, fontWeight: 'bold', color: '#ff6b6b' },
  formContainer: { padding: 20, gap: 15 },
  previewContainer: { width: '100%', height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 5, position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewText: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: 4, borderRadius: 5, fontSize: 10 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, color: '#333' },
  selectRow: { flexDirection: 'row', gap: 15 },
  pickerBox: { flex: 1 },
  pickerLabel: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  pickerButton: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveButton: { backgroundColor: '#2ed573', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});