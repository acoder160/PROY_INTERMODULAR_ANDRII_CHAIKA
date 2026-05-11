// app/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!username || !email || !password) {
      alert("Por favor, rellena todos los campos.");
      return;
    }

    setIsLoading(true);
    try {
      // Petición real al backend para registrar[cite: 2]
      await axios.post(`${API_BASE_URL}/api/auth/register`, 
        {
          username: username,
          email: email,
          password: password
        },
        {
          headers: { "ngrok-skip-browser-warning": "true" }
        }
      );

      alert("Cuenta creada con éxito. Ahora puedes iniciar sesión.");
      router.replace('/login');
    } catch (error) {
      console.error(error);
      alert("Error al registrar la cuenta. El usuario o email podría existir.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Únete al Crew</Text>
        <Text style={styles.subtitle}>Crea tu cuenta en SkateMap</Text>

        <Text style={styles.label}>Nombre de Usuario</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.inputDark} placeholder="tu@email.com" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />

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
    </View>
  );
}

// Reutilizamos los mismos estilos oscuros
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#2C2C2C', width: '100%', maxWidth: 400, padding: 30, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  title: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  subtitle: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 30 },
  label: { color: '#E0E0E0', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#E8F0FE', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: '#333' },
  inputDark: { backgroundColor: '#3A3A3A', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: 'white', borderWidth: 1, borderColor: '#444' },
  button: { backgroundColor: '#FF9F1C', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#AAA' },
  link: { color: '#FF9F1C', fontWeight: 'bold' }
});