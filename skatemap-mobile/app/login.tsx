import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isWakingUp, setIsWakingUp] = useState(false); 
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!username || !password) {
      setErrorMessage(t('auth.fillAll'));
      return;
    }

    setIsLoading(true);
    setIsWakingUp(false);

    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      const response = await api.post('/auth/login',
        { username, password },
      );

      if (Platform.OS !== 'web' && !response.data.refreshToken) {
        throw new Error('Refresh token missing from login response');
      }

      await login(
        response.data.username || username,
        response.data.token,
        response.data.refreshToken
      );
      router.replace('/(tabs)');
    } catch (error) {
      console.error(error);
      setErrorMessage(t('auth.loginFailed'));
    } finally {
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
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />
        <View style={styles.card}>
          <LinearGradient colors={['#2EC4B6', '#168AAD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </LinearGradient>
          <Text style={styles.eyebrow}>SKATEMAP / EXPLORE MORE</Text>
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.tagline')}</Text>

          {errorMessage && !isLoading && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {isWakingUp && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#66E3E7" />
              <Text style={styles.loadingText}>{t('auth.wakingUp')}</Text>
              <Text style={styles.loadingSubText}>{t('auth.wakingUpHint')}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.88}>
            <LinearGradient colors={['#2EC4B6', '#168AAD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <LinearGradient colors={['#66E3E7', '#2EC4B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.linkPill}>
                <Text style={styles.link}>{t('auth.registerHere')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.guestButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.guestButtonText}>{t('auth.backToMap')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071525' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20, overflow: 'hidden' },
  backgroundGlowOne: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(46,196,182,0.12)', top: -70, right: -90 },
  backgroundGlowTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(22,138,173,0.16)', bottom: -70, left: -90 },
  card: { backgroundColor: 'rgba(15, 39, 63, 0.94)', width: '100%', maxWidth: 430, alignSelf: 'center', padding: 30, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(126, 232, 236, 0.18)', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.38, shadowRadius: 24, elevation: 12 },
  brandMark: { width: 52, height: 52, borderRadius: 18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  brandMarkText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  eyebrow: { color: '#66E3E7', fontSize: 10, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
  title: { color: '#F5FEFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 7 },
  subtitle: { color: '#A9C5D2', fontSize: 14, textAlign: 'center', marginBottom: 26 },
  
  errorBox: { backgroundColor: 'rgba(255, 71, 87, 0.1)', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.3)' },
  errorText: { color: '#ff4757', textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  
  loadingBox: { backgroundColor: 'rgba(46, 196, 182, 0.1)', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(102, 227, 231, 0.3)', alignItems: 'center' },
  loadingText: { color: '#66E3E7', textAlign: 'center', fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  loadingSubText: { color: '#66E3E7', textAlign: 'center', fontSize: 12, marginTop: 2, opacity: 0.8 },
  
  label: { color: '#D5E8EE', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: 'rgba(4, 20, 35, 0.62)', borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(126, 195, 211, 0.28)' },
  button: { padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 10, shadowColor: '#168AAD', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#8FAFBC' },
  linkPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  link: { color: '#062033', fontWeight: '900', fontSize: 13 },
  guestButton: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  guestButtonText: { color: '#7897A5', fontSize: 14, textDecorationLine: 'underline' }
});