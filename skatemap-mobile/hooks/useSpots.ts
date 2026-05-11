// skatemap-mobile/hooks/useSpots.ts
import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export function useSpots(token: string | null) {
  const [spots, setSpots] = useState([]);

  const fetchSpots = useCallback(async () => {
    if (!token) return; 
    try {
      const response = await axios.get(`${API_BASE_URL}/api/spots`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } 
      });
      setSpots(response.data);
    } catch (error) {
      console.error("Error cargando spots:", error);
    }
  }, [token]);

  return { spots, fetchSpots };
}