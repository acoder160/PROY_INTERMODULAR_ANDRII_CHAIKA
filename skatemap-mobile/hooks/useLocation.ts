// skatemap-mobile/hooks/useLocation.ts
import { useState } from 'react';
import * as Location from 'expo-location';

export function useLocation() {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Le pasamos la función setStatusMessage para que pueda enviar mensajes a la pantalla principal
  const handleRecenter = async (silent = false, setStatusMessage?: (msg: string | null) => void) => {
    
    const notify = (msg: string | null, isError = false) => {
      if (!silent && setStatusMessage) {
        setStatusMessage(msg);
        if (isError) setTimeout(() => setStatusMessage(null), 3000);
      }
    };

    notify('📍 Obteniendo tu ubicación actual...');

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        notify('⚠️ Permiso de GPS denegado', true);
        return null;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
      setUserLocation(coords);
      notify(null);
      return coords;
    } catch (error) {
      let lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
        setUserLocation(coords);
        notify(null);
        return coords;
      } else { 
        notify('⚠️ Error buscando ubicación', true);
        return null;
      }
    }
  };

  return { userLocation, handleRecenter };
}