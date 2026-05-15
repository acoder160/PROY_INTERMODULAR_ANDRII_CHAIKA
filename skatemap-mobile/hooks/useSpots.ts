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
      // Intentamos conectar con el servidor Spring Boot
      const response = await axios.get(`${API_BASE_URL}/api/spots`, {
        headers: token ? { 
          Authorization: `Bearer ${token}`, 
          "ngrok-skip-browser-warning": "true" 
        } : { 
          "ngrok-skip-browser-warning": "true" 
        }
      });
      
      // Si hay éxito, actualizamos la app y apagamos el modo offline
      setSpots(response.data);
      setIsOffline(false);
      
      // Guardamos silenciosamente la copia de seguridad en el móvil
      await AsyncStorage.setItem('@skatemap_spots_cache', JSON.stringify(response.data));

    } catch (err: unknown) {
      console.log("Servidor inaccesible. Activando Modo Offline 📡❌");

      // Manejo seguro del error de tipo desconocido
      if (axios.isAxiosError(err)) {
        console.log("DETALLES DEL ERROR:", err.response?.data || err.message);
      } else if (err instanceof Error) {
        console.log("DETALLES DEL ERROR:", err.message);
      } else {
        console.log("DETALLES DEL ERROR:", String(err));
      }

      console.log("TOKEN QUE ESTAMOS ENVIANDO:", token);


      setIsOffline(true);
      
      // Si falla la red, leemos la memoria interna del teléfono
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