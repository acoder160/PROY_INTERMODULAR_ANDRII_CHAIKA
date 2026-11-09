import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import 'react-native-reanimated';
import '../utils/textDecoderPolyfill';
import {
  useFonts,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';

import '../i18n';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UnreadProvider } from '../context/UnreadContext';
import { onPushTapped, registerForPush } from '../utils/push';

/** Registers this device for push after sign-in, and opens the right screen when a push is tapped. */
function PushBridge() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (user) registerForPush(i18n.language);
  }, [user, i18n.language]);

  useEffect(() => onPushTapped((target) => router.push(target as any)), [router]);

  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_900Black,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <AuthProvider>
      <UnreadProvider>
      <PushBridge />
      <ThemeProvider value={DarkTheme}>
        {/* Envolvemos todo en una View negra por si el Stack falla un frame */}
        <View style={{ flex: 1, backgroundColor: '#1E1E1E' }}>
          <Stack 
            screenOptions={{ 
              headerShown: false, 
              contentStyle: { backgroundColor: '#1E1E1E' },
              // Eliminamos el header transparente por si acaso
              headerStyle: { backgroundColor: '#1E1E1E' },
            }}
          >
            {/*Forzamos animación de desvanecimiento (fade) sin deslizamiento */}
            <Stack.Screen 
              name="login" 
              options={{ animation: 'fade' }} 
            />
            <Stack.Screen 
              name="register" 
              options={{ animation: 'fade' }} 
            />
            
            {/* Las pestañas principales pueden mantener su animación por defecto */}
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="user/[username]" />
            <Stack.Screen name="saved" />
            <Stack.Screen name="profile-edit" />
          </Stack>
        </View>
      </ThemeProvider>
      </UnreadProvider>
    </AuthProvider>
  );
}