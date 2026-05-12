import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export default function AddSpotScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoadingLoc, setIsLoadingLoc] = useState(false);

  // Función para obtener Geolocalización
  const getLocation = async () => {
    setIsLoadingLoc(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Se denegó el permiso para acceder a la ubicación');
        setIsLoadingLoc(false);
        return;
      }

      let currentLoc = await Location.getCurrentPositionAsync({});
      setLocation(currentLoc);
    } catch (error) {
      alert('Error al obtener la ubicación. Comprueba los permisos de tu navegador.');
    } finally {
      setIsLoadingLoc(false);
    }
  };

  // Función para abrir la cámara o galería
  const takePhoto = async () => {
    // Pedimos permisos
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("Necesitamos permisos para usar la cámara.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSaveSpot = () => {
    if (!name || !location || !imageUri) {
      alert('Falta información (Nombre, Ubicación o Foto)');
      return;
    }

    const newSpot = {
      name,
      description,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      imageUri,
    };

    console.log('Spot listo para enviar al backend (Spring Boot):', newSpot);
    alert('Spot guardado temporalmente (Revisa la consola)');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🛹 Añadir Nuevo Spot</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre del spot (ej. Antoniuti)"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Descripción..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      {/* Botón Geolocalización */}
      <TouchableOpacity style={styles.buttonSecondary} onPress={getLocation}>
        <Text style={styles.buttonText}>
          {isLoadingLoc ? "Buscando..." : "📍 Obtener mi Ubicación"}
        </Text>
      </TouchableOpacity>
      
      {location && (
        <Text style={styles.infoText}>
          Lat: {location.coords.latitude.toFixed(4)} | Lng: {location.coords.longitude.toFixed(4)}
        </Text>
      )}

      {/* Botón Foto */}
      <TouchableOpacity style={styles.buttonSecondary} onPress={takePhoto}>
        <Text style={styles.buttonText}>📸 Tomar Foto</Text>
      </TouchableOpacity>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}

      {/* Botón Guardar */}
      <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveSpot}>
        <Text style={styles.buttonText}>Guardar Spot</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F9FA', 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonPrimary: {
    backgroundColor: '#2EC4B6', 
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonSecondary: {
    backgroundColor: '#FF9F1C', // Color Acento
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoText: {
    textAlign: 'center',
    color: '#6C757D',
    marginBottom: 15,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
    resizeMode: 'cover',
  },
});