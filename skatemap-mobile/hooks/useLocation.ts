// skatemap-mobile/hooks/useLocation.ts
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';

export function useLocation() {
  const { t } = useTranslation();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Le pasamos la función setStatusMessage para que pueda enviar mensajes a la pantalla principal
  // (useCallback: la función es estable, así los useEffect que dependen de ella no se repiten en cada render)
  const handleRecenter = useCallback(async (silent = false, setStatusMessage?: (msg: string | null) => void) => {

    const notify = (msg: string | null, isError = false) => {
      if (!silent && setStatusMessage) {
        setStatusMessage(msg);
        if (isError) setTimeout(() => setStatusMessage(null), 3000);
      }
    };

    notify(t('status.gettingLocation'));

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        notify(t('status.gpsDenied'), true);
        return null;
      }
      // Camino rápido: última posición conocida (instantánea) y la afinamos en segundo plano
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 200 });
      if (cached) {
        const cachedCoords = { lat: cached.coords.latitude, lng: cached.coords.longitude };
        setUserLocation(cachedCoords);
        notify(null);
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((fresh) => {
            const freshCoords = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
            // Solo actualizamos si nos hemos movido de forma apreciable (evita saltos innecesarios)
            const dLat = (freshCoords.lat - cachedCoords.lat) * 111320;
            const dLng = (freshCoords.lng - cachedCoords.lng) * 111320 * Math.cos(cachedCoords.lat * Math.PI / 180);
            if (Math.hypot(dLat, dLng) > 30) setUserLocation(freshCoords);
          })
          .catch(() => {});
        return cachedCoords;
      }

      // Sin caché: primero una lectura rápida de baja precisión
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
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
        notify(t('status.locationError'), true);
        return null;
      }
    }
  }, [t]);

  return { userLocation, handleRecenter };
}
