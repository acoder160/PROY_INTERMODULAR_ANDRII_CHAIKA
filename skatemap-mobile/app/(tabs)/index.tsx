import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SkateMap from '../../components/skatemap';
import { Redirect } from 'expo-router';
import * as Location from 'expo-location';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

export default function HomeScreen() {
  const [spots, setSpots] = useState([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const { user, token, logout } = useAuth(); 

  // ESTADOS DE CREACIÓN DE SPOT
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState<{lat: number, lng: number} | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });

  // 1. CARGAR SPOTS
  const fetchSpots = async () => {
    if (!token) return; 
    try {
      const response = await axios.get('https://small-geese-invite.loca.lt/api/spots', {
        headers: { Authorization: `Bearer ${token}`, "Bypass-Tunnel-Reminder": "true" } 
      });
      setSpots(response.data);
    } catch (error) { console.error("Error cargando spots:", error); }
  };

  useEffect(() => { fetchSpots(); }, [token]);

  // 2. FUNCIÓN DE UBICACIÓN CORREGIDA
  const handleRecenter = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('GPS denegado. Mostrando Pamplona por defecto.');
        return;
      }
      // Usamos Low/Balanced porque HighAccuracy a veces se bloquea en los emuladores
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    } catch (error) {
      console.warn("GPS falló o tarda mucho. Probando última posición conocida...");
      // Plan B si el GPS de alta precisión falla
      let lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setUserLocation({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
      } else {
        alert('No se pudo encontrar tu ubicación. Comprueba el GPS de tu móvil.');
      }
    }
  };

  // 3. GUARDAR EL NUEVO SPOT EN EL BACKEND
  const handleSaveSpot = async () => {
    if (!newSpotLocation || !formData.name) return;
    try {
      await axios.post('https://small-geese-invite.loca.lt/api/spots', { 
        ...formData, 
        latitude: newSpotLocation.lat, 
        longitude: newSpotLocation.lng 
      }, {
        headers: { Authorization: `Bearer ${token}`, "Bypass-Tunnel-Reminder": "true" }
      });
      alert('¡Spot creado!');
      setModalVisible(false);
      setIsAddingMode(false);
      setNewSpotLocation(null);
      setFormData({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' }); // Reset
      fetchSpots(); // Recargar el mapa
    } catch (error) {
      alert('Error al crear spot');
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
          // CORRECCIÓN: Tipos para evitar errores de TS
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

      {/* BOTÓN FLOTANTE DINÁMICO */}
      <TouchableOpacity 
        style={[
          styles.fab, 
          isAddingMode ? styles.fabClose : styles.fabAdd
        ]} 
        onPress={() => {
          setIsAddingMode(!isAddingMode);
          setNewSpotLocation(null);
        }}
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

      {/* BOTÓN PRINCIPAL: ACTIVAR/DESACTIVAR AÑADIR SPOT */}
      <TouchableOpacity 
        style={[styles.fab, isAddingMode ? { backgroundColor: '#ff4757', paddingHorizontal: 15 } : {}]} 
        onPress={() => {
          setIsAddingMode(!isAddingMode);
          setNewSpotLocation(null);
        }}
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

      {/* MODAL: FORMULARIO DE CREACIÓN */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* 1. Usamos KeyboardAvoidingView como overlay para que se ajuste al teclado */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          {/* 2. Le ponemos un maxHeight a la caja blanca para que nunca se salga de la pantalla */}
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Spot 📍</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setIsAddingMode(false); }}>
                <Text style={styles.closeButtonText}>✕ Cancelar</Text>
              </TouchableOpacity>
            </View>
            
            {/* 3. Cambiamos el View del formulario por un ScrollView */}
            <ScrollView 
              contentContainerStyle={styles.formContainer} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveSpot}>
                <Text style={styles.saveButtonText}>Guardar Spot</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  addingNotice: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, zIndex: 10 },
  addingNoticeText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  recenterButton: { position: 'absolute', right: 20, bottom: 100, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5, zIndex: 10 },
  iconText: { fontSize: 24 },

  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#2ed573', flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, zIndex: 10 },
  fabIcon: { fontSize: 20, marginRight: 8, color: 'white', fontWeight: 'bold' },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  fabAdd: {
    backgroundColor: '#2ed573',
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
  },
  fabClose: {
    backgroundColor: '#ff4757',
    width: 60, // Círculo perfecto
    height: 60,
    borderRadius: 30},
    

  // MODAL Y FORMULARIO
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 20, overflow: 'hidden', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButtonText: { fontSize: 14, fontWeight: 'bold', color: '#ff6b6b' },
  
  formContainer: { padding: 20, gap: 15 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, color: '#333' },
  
  selectRow: { flexDirection: 'row', gap: 15 },
  pickerBox: { flex: 1 },
  pickerLabel: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  pickerButton: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  
  saveButton: { backgroundColor: '#2ed573', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});