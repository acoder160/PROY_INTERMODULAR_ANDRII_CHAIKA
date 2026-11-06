import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Palette, DisplayFont, Radius, MIN_TARGET } from '../constants/theme';
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
        <View style={styles.card}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.tagline')}</Text>

          {errorMessage && !isLoading && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {isWakingUp && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Palette.yellow} />
              <Text style={styles.loadingText}>{t('auth.wakingUp')}</Text>
              <Text style={styles.loadingSubText}>{t('auth.wakingUpHint')}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor={Palette.inkMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Palette.inkMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.88}>
            <View style={styles.button}>
              {isLoading ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>}
            </View>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <View style={styles.linkPill}>
                <Text style={styles.link}>{t('auth.registerHere')}</Text>
              </View>
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
  container: { flex: 1, backgroundColor: Palette.asphalt },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: Palette.asphaltRaised, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 24, borderRadius: Radius.sheet, borderWidth: 2, borderColor: Palette.white },
  brandMark: { width: 56, height: 56, borderRadius: 16, backgroundColor: Palette.pink, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: Palette.ink },
  brandMarkText: { color: Palette.ink, fontFamily: DisplayFont.black, fontSize: 36, lineHeight: 40 },
  title: { color: Palette.white, fontFamily: DisplayFont.black, fontSize: 38, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', marginBottom: 6 },
  subtitle: { color: Palette.onAsphaltMuted, fontSize: 15, textAlign: 'center', marginBottom: 24 },

  errorBox: { backgroundColor: '#3A1B1B', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: Palette.dangerOnDark },
  errorText: { color: Palette.dangerOnDark, textAlign: 'center', fontSize: 15, fontWeight: '700' },

  loadingBox: { backgroundColor: Palette.asphalt, padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: Palette.yellow, alignItems: 'center' },
  loadingText: { color: Palette.yellow, textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 8 },
  loadingSubText: { color: Palette.onAsphaltMuted, textAlign: 'center', fontSize: 13, marginTop: 2 },

  label: { color: Palette.white, fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: Palette.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: MIN_TARGET, marginBottom: 18, fontSize: 16, color: Palette.ink, borderWidth: 2, borderColor: Palette.white },
  button: { minHeight: 56, borderRadius: 28, backgroundColor: Palette.pink, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: Palette.ink, fontFamily: DisplayFont.black, fontSize: 24, letterSpacing: 1, textTransform: 'uppercase' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  footerText: { color: Palette.onAsphaltMuted, fontSize: 15 },
  linkPill: { minHeight: MIN_TARGET, paddingHorizontal: 6, justifyContent: 'center' },
  link: { color: Palette.pink, fontWeight: '800', fontSize: 16, textDecorationLine: 'underline' },
  guestButton: { marginTop: 4, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TARGET },
  guestButtonText: { color: Palette.onAsphaltMuted, fontSize: 15, textDecorationLine: 'underline' }
});
