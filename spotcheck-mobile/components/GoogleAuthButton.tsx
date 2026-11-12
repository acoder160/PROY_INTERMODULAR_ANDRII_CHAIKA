import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  exchangeGoogleBrowserCode,
  leaveAuthScreens,
  startGoogleBrowserSignIn,
} from '../utils/googleBrowserSignIn';
import { DisplayFont, Palette } from '../constants/theme';

/**
 * Google sign-in is configured on the backend; this flag only hides the button in builds where it
 * isn't set up. The value is the same web OAuth client ID the website uses.
 */
const GOOGLE_ENABLED = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

/**
 * "Continue with Google" on the login/register screens.
 *
 * Uses the system browser (no native SDK, works in Expo Go and in any build): the backend runs the
 * OAuth flow with Google using the web client, then sends the app a one-time code that only this
 * app can redeem, thanks to its PKCE verifier. The result is the same session as a password login.
 */
export default function GoogleAuthButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (Platform.OS === 'web' || !GOOGLE_ENABLED) return null;

  const signIn = async () => {
    const result = await startGoogleBrowserSignIn();
    if (result.type === 'cancel') return null;
    if (result.type === 'error') throw new Error(`Google browser sign-in: ${result.error}`);
    return exchangeGoogleBrowserCode(result.code, result.attempt, result.verifier);
  };

  const handlePress = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await signIn();
      if (!session) return;
      await login(session.username, session.token, session.refreshToken, session.role);
      console.log('Google sign-in: signed in as', session.username);
      leaveAuthScreens(router);
    } catch (e: any) {
      console.log('Google sign-in failed:', e?.response?.status ?? e?.code ?? e?.message, e?.response?.data ?? '');
      // A request with no response means no connection; anything else is a Google or server error
      const noServer = e?.isAxiosError && !e?.response;
      setError(noServer ? t('popup.sendErrorConnection') : t('auth.googleFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonBusy]}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ busy: isLoading, disabled: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color={Palette.ink} />
        ) : (
          <>
            <Ionicons name="logo-google" size={22} color={Palette.ink} />
            <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {t('auth.continueWithGoogle')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 18 },
  error: { color: Palette.dangerOnDark, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  button: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Palette.white,
    borderWidth: 2,
    borderColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 20,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
});
