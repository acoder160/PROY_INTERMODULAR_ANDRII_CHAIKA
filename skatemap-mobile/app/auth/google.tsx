import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Palette } from '../../constants/theme';

/**
 * Vuelta del login con Google por navegador (…/--/auth/google?code=…).
 * El código lo recoge GoogleAuthButton vía WebBrowser.openAuthSessionAsync; si Expo Router además
 * abre esta ruta (Android), solo volvemos a la pantalla anterior sin mostrar nada.
 */
export default function GoogleAuthReturn() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: Palette.asphalt }} />;
}
