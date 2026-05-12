import { useState, useCallback } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

export const useSpots = (token: string | null) => {
  const [spots, setSpots] = useState<any[]>([]);
  // estado para saber si estamos tirando de la caché
  const [isOffline, setIsOffline] = useState(false);

  const fetchSpots = useCallback(async () => {
    try {
      // 1. Intentamos conectar con el servidor Spring Boot
      const response = await axios.get(`${API_BASE_URL}/api/spots`, {
        headers: token ? { 
          Authorization: `Bearer ${token}`, 
          "ngrok-skip-browser-warning": "true" 
        } : { 
          "ngrok-skip-browser-warning": "true" 
        }
      });
      
      // 2. Si hay éxito, actualizamos la app y apagamos el modo offline
      setSpots(response.data);
      setIsOffline(false);
      
      // 3. Guardamos silenciosamente la copia de seguridad en el móvil
      await AsyncStorage.setItem('@skatemap_spots_cache', JSON.stringify(response.data));

    } catch (error) {
      console.log("Servidor inaccesible. Activando Modo Offline 📡❌");
      setIsOffline(true);
      
      // 4. Si falla la red, leemos la memoria interna del teléfono
      try {
        const cachedSpots = await AsyncStorage.getItem('@skatemap_spots_cache');
        if (cachedSpots !== null) {
          setSpots(JSON.parse(cachedSpots)); // Cargamos los datos antiguos
        }
      } catch (cacheError) {
        console.error("Error al leer la caché local", cacheError);
      }
    }
  }, [token]);

  return { spots, fetchSpots, isOffline }; // Exportamos isOffline para usarlo en la UI
};