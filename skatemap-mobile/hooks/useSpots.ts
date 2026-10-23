import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export const useSpots = (_token: string | null) => {
  const [spots, setSpots] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const fetchSpots = useCallback(async () => {
    try {
      const response = await api.get('/spots');
      setSpots(response.data);
      setIsOffline(false);
      await AsyncStorage.setItem('@skatemap_spots_cache', JSON.stringify(response.data));
    } catch (err: unknown) {
      console.log('Servidor inaccesible. Activando Modo Offline');
      if (err instanceof Error) {
        console.log('DETALLES DEL ERROR:', err.message);
      } else {
        console.log('DETALLES DEL ERROR:', String(err));
      }

      setIsOffline(true);
      try {
        const cachedSpots = await AsyncStorage.getItem('@skatemap_spots_cache');
        if (cachedSpots !== null) {
          setSpots(JSON.parse(cachedSpots));
        }
      } catch (cacheError) {
        console.error('Error al leer la caché local', cacheError);
      }
    }
  }, []);

  return { spots, fetchSpots, isOffline };
};
