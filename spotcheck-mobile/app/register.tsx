import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Palette, DisplayFont, Radius, MIN_TARGET } from '../constants/theme';
import GradientFill from '../components/ui/GradientFill';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { hasLegalPage, openLegalPage } from '../utils/legal';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  
  // Estado para saber si el servidor está tardando
  const [isWakingUp, setIsWakingUp] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async () => {
    setErrorMessage(null);

    // La autocorrección del teclado suele dejar un espacio al final del email: el servidor lo rechaza
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !cleanEmail || !password) {
      setErrorMessage(t('auth.fillAll'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage(t('auth.emailInvalid'));
      return;
    }

    if (!accepted) {
      setErrorMessage(t('auth.acceptRequired'));
      return;
    }

    setIsLoading(true);
    setIsWakingUp(false); // Aseguramos que empiece oculto

    // cronómetro de 3 segundos
    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      await api.post('/auth/register',
        { username: cleanUsername, email: cleanEmail, password },
      );

      Alert.alert(t('auth.welcomeTitle'), t('auth.accountCreated'), [
        { text: t('common.ok'), onPress: () => router.replace('/login') }
      ]);

    } catch (error: any) {
      // Mostramos la causa real en vez de un mensaje genérico
      const status = error?.response?.status;
      const body = typeof error?.response?.data === 'string' ? error.response.data : '';
      // Validation errors come back as { message, errors: { field: reason } }
      const fieldErrors = error?.response?.data?.errors ?? {};
      console.log('Registration failed:', status ?? error?.message, body || fieldErrors);
      if (!error?.response) setErrorMessage(t('popup.sendErrorConnection'));
      else if (/username/i.test(body)) setErrorMessage(t('auth.usernameTaken'));
      else if (/email/i.test(body)) setErrorMessage(t('auth.emailTaken'));
      else if (fieldErrors.password || fieldErrors.username) setErrorMessage(fieldErrors.password || fieldErrors.username);
      else if (status === 400) setErrorMessage(t('auth.emailInvalid'));
      else setErrorMessage(t('auth.registerFailed'));
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
      <GradientFill name="authScreen" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <GradientFill name="authCard" radius={26} />
          <View style={styles.brandMark}>
            <GradientFill name="pink" radius={14} />
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <Text style={styles.title}>{t('auth.joinCrew')}</Text>
          <Text style={styles.subtitle}>{t('auth.createAccountSubtitle')}</Text>


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
            placeholder={t('auth.registerUsernamePlaceholder')}
            placeholderTextColor={Palette.inkMuted}
            value={username} 
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            textContentType="username"
          />

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput 
            style={styles.input} 
            placeholder={t('auth.emailPlaceholder')} 
            placeholderTextColor={Palette.inkMuted} 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput 
            style={styles.input} 
            placeholder="••••••••"
            placeholderTextColor={Palette.inkMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <View style={styles.consentRow}>
            <TouchableOpacity
              onPress={() => setAccepted(a => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              style={[styles.checkbox, accepted && styles.checkboxOn]}
            >
              {accepted && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.consentText} onPress={() => setAccepted(a => !a)}>
              {t('auth.acceptTerms')}{' '}
              {hasLegalPage && (
                <Text style={styles.link} onPress={openLegalPage}>{t('legal.link')}</Text>
              )}
            </Text>
          </View>

          <TouchableOpacity onPress={handleRegister} disabled={isLoading} activeOpacity={0.88}>
            <View style={styles.button}>
              <GradientFill name="pink" radius={26} />
              {isLoading ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.buttonText}>{t('auth.createAccount')}</Text>}
            </View>
          </TouchableOpacity>

          <GoogleAuthButton />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')} </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <View style={styles.linkPill}>
                <Text style={styles.link}>{t('auth.loginLink')}</Text>
              </View>
            </TouchableOpacity>
          </View>
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
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: Palette.pink, borderColor: Palette.ink },
  checkMark: { color: Palette.ink, fontWeight: '900', fontSize: 18 },
  consentText: { flex: 1, color: Palette.onAsphaltMuted, fontSize: 14, lineHeight: 19 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  footerText: { color: Palette.onAsphaltMuted, fontSize: 15 },
  linkPill: { minHeight: MIN_TARGET, paddingHorizontal: 6, justifyContent: 'center' },
  link: { color: Palette.pink, fontWeight: '800', fontSize: 16, textDecorationLine: 'underline' },
  guestButton: { marginTop: 4, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TARGET },
  guestButtonText: { color: Palette.onAsphaltMuted, fontSize: 15, textDecorationLine: 'underline' }
});
