import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import {
  useFonts,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';

import '../i18n';
import { AuthProvider } from '../context/AuthContext';

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
          </Stack>
        </View>
      </ThemeProvider>
    </AuthProvider>
  );
}