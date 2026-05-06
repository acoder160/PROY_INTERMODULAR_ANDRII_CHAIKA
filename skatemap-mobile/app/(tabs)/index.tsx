import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Importamos nuestro contexto de autenticación
import SkateMap from '../../components/skatemap';
import { useRouter, Redirect } from 'expo-router';
import AddSpotScreen from './explore'; 

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [spots, setSpots] = useState([]);
  
  const { user, token, logout } = useAuth(); 

  // 1. CONEXIÓN AL BACKEND
  const fetchSpots = async () => {
    if (!token) return; 
    
    try {
      const response = await axios.get('http://localhost:8080/api/spots', {
        headers: { Authorization: `Bearer ${token}` } 
      });
      setSpots(response.data);
      console.log("Spots cargados de la base de datos:", response.data);
    } catch (error) {
      console.error("Error cargando spots:", error);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, [token]);

  // Redirección declarativa y segura de Expo Router
  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      
      {/* MAPA */}
      <View style={styles.mapContainer}>
        {/* Aquí en el futuro le pasaremos los 'spots' como props a SkateMap */}
        <SkateMap />
      </View>

      {/* BADGE DE USUARIO DINÁMICO (Arriba centro) */}
      <View style={styles.userBadge}>
        <Text style={styles.userName}>👤 {user}</Text>
        <View style={styles.separator} />
        {/* Conectamos el botón de salir a la función del contexto */}
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* BOTÓN RECENTRAR (Derecha) */}
      <TouchableOpacity style={styles.recenterButton}>
        <Text style={styles.iconText}>🔄</Text>
      </TouchableOpacity>

      {/* BOTÓN PIN (Abajo derecha) */}
      <TouchableOpacity style={styles.pinButton}>
        <Text style={styles.iconText}>📍</Text>
      </TouchableOpacity>

      {/* BOTÓN FLOTANTE: AÑADIR SPOT (Abajo centro) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabIcon}>➕</Text>
        <Text style={styles.fabText}>Añadir Spot</Text>
      </TouchableOpacity>

      {/* MODAL DEL FORMULARIO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕ Cerrar</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <AddSpotScreen />
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: { flex: 1, backgroundColor: '#e5e5e5' },
  
  // Estilo del Badge de Usuario (Arriba)
  userBadge: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: { fontWeight: 'bold', color: '#1A1A1A', marginRight: 10 },
  separator: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginRight: 10 },
  logoutText: { color: '#FF6B35', fontWeight: 'bold' },

  // Botón Recentrar (Derecha)
  recenterButton: {
    position: 'absolute',
    right: 15,
    top: '45%',
    backgroundColor: 'white',
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Botón Pin (Abajo derecha)
  pinButton: {
    position: 'absolute',
    right: 15,
    bottom: 30,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconText: { fontSize: 20 },

  // Botón Añadir Spot 
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#2EC4B6', // Verde/Turquesa
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  fabIcon: { fontSize: 18, marginRight: 8, color: 'white' },
  fabText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F8F9FA', height: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, overflow: 'hidden' },
  closeButton: { alignSelf: 'flex-end', padding: 15 },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FF6B35' }
});