import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Estado para saber si el servidor está tardando
  const [isWakingUp, setIsWakingUp] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!username || !email || !password) {
      setErrorMessage("Por favor, rellena todos los campos.");
      return;
    }

    setIsLoading(true);
    setIsWakingUp(false); // Aseguramos que empiece oculto

    // cronómetro de 3 segundos
    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, 
        { username, email, password },
        { headers: { "ngrok-skip-browser-warning": "true" } }
      );

      Alert.alert("¡Bienvenido!", "Cuenta creada con éxito. Ahora puedes iniciar sesión.", [
        { text: "OK", onPress: () => router.replace('/login') }
      ]);
      
    } catch (error) {
      console.error(error);
      setErrorMessage("Error al registrar la cuenta. El usuario o email podría existir.");
    } finally {
      // Paramos el cronómetro y limpiamos estados
      clearTimeout(wakeUpTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Únete al Crew</Text>
          <Text style={styles.subtitle}>Crea tu cuenta en SkateMap</Text>


          {errorMessage && !isLoading && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}


          {isWakingUp && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#2ed573" />
              <Text style={styles.loadingText}>Levantando el servidor...</Text>
              <Text style={styles.loadingSubText}>(suele tardar entre 1 y 2 minutos)</Text>
            </View>
          )}

          <Text style={styles.label}>Nombre de Usuario</Text>
          <TextInput 
            style={styles.input} 
            placeholder="skater_pro"
            placeholderTextColor="#888"
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none" 
          />

          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="tu@email.com" 
            placeholderTextColor="#888" 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
            keyboardType="email-address" 
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput 
            style={styles.input} 
            placeholder="••••••••"
            placeholderTextColor="#888"
            secureTextEntry 
            value={password} 
            onChangeText={setPassword} 
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Crear Cuenta</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1E1E' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#2C2C2C', width: '100%', maxWidth: 400, padding: 30, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  title: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  subtitle: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  
  errorBox: { backgroundColor: 'rgba(255, 71, 87, 0.1)', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.3)' },
  errorText: { color: '#ff4757', textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  
  loadingBox: { backgroundColor: 'rgba(46, 213, 115, 0.1)', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(46, 213, 115, 0.3)', alignItems: 'center' },
  loadingText: { color: '#2ed573', textAlign: 'center', fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  loadingSubText: { color: '#2ed573', textAlign: 'center', fontSize: 12, marginTop: 2, opacity: 0.8 },
  
  label: { color: '#E0E0E0', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#3A3A3A', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: 'white', borderWidth: 1, borderColor: '#444' },
  button: { backgroundColor: '#FF9F1C', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#AAA' },
  link: { color: '#FF9F1C', fontWeight: 'bold' }
});