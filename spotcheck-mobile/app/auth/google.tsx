import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Palette } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { exchangeGoogleBrowserCode, leaveAuthScreens } from '../../utils/googleBrowserSignIn';

/**
 * Vuelta del login con Google por navegador (…/--/auth/google?code=…).
 * En Android, Expo Router navega a esta ruta al recibir el deep link de retorno. Canjea el código
 * (de forma deduplicada con GoogleAuthButton) y cierra las pantallas de login hacia /(tabs), en vez
 * de hacer router.back() y devolver al usuario a /login.
 */
export default function GoogleAuthReturn() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { code, a } = useLocalSearchParams<{ code?: string; a?: string }>();

  useEffect(() => {
    if (user) {
      leaveAuthScreens(router);
      return;
    }

    const oneTimeCode = typeof code === 'string' ? code : null;
    const attemptId = typeof a === 'string' ? a : null;
    if (!oneTimeCode) {
      if (router.canGoBack()) router.back();
      else router.replace('/login');
      return;
    }

    let cancelled = false;
    exchangeGoogleBrowserCode(oneTimeCode, attemptId)
      .then(async (session) => {
        if (cancelled) return;
        await login(session.username, session.token, session.refreshToken, session.role);
        console.log('Google sign-in: signed in via return route as', session.username);
        leaveAuthScreens(router);
      })
      .catch((e: any) => {
        if (cancelled) return;
        console.log('Google sign-in return route failed:', e?.response?.status ?? e?.message);
        if (router.canGoBack()) router.back();
        else router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [user, code, a, login, router]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={Palette.white} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
