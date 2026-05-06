// app/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Por favor, rellena todos los campos.");
      return;
    }

    setIsLoading(true);
    try {
      // Petición real al backend Spring Boot[cite: 2]
      const response = await axios.post('http://localhost:8080/api/auth/login', {
        username: username,
        password: password
      });

      // Guardamos el usuario y el token JWT recibido
      login(response.data.username || username, response.data.token);
      
      // Redirigimos al mapa principal
      router.replace('/(tabs)');
    } catch (error) {
      console.error(error);
      alert("Error al iniciar sesión. Comprueba tus credenciales.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🛹 SkateMap</Text>
        <Text style={styles.subtitle}>Encuentra los mejores spots de la ciudad</Text>

        <Text style={styles.label}>Usuario</Text>
        <TextInput
          style={styles.input}
          placeholder="admin"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>Regístrate aquí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Estilos calcados de tu captura de pantalla
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#2C2C2C', width: '100%', maxWidth: 400, padding: 30, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  title: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  subtitle: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 30 },
  label: { color: '#E0E0E0', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#E8F0FE', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: '#333' },
  button: { backgroundColor: '#FF9F1C', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#AAA' },
  link: { color: '#FF9F1C', fontWeight: 'bold' }
});