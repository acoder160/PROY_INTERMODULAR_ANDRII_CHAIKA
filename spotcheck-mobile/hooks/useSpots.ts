import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

const CACHE_KEY = '@skatemap_spots_cache';
const ETAG_KEY = '@skatemap_spots_etag';

async function readCachedSpots(): Promise<any[] | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached !== null ? JSON.parse(cached) : null;
  } catch (cacheError) {
    console.error('Could not read the local spot cache', cacheError);
    return null;
  }
}

/**
 * Loads all spots and keeps a local copy for offline use. The server sends an ETag; on the next
 * load the app asks "has it changed since this version?" and, if not, gets an empty 304 and reuses
 * its copy instead of downloading the whole list again.
 */
export const useSpots = (_token: string | null) => {
  const [spots, setSpots] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const fetchSpots = useCallback(async () => {
    try {
      const [cached, etag] = await Promise.all([readCachedSpots(), AsyncStorage.getItem(ETAG_KEY)]);
      const response = await api.get('/spots', {
        // Only ask for a 304 when there is a local copy to fall back on
        headers: cached && etag ? { 'If-None-Match': etag } : undefined,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      });

      if (response.status === 304 && cached) {
        setSpots(cached);
      } else {
        setSpots(response.data);
        const newEtag = response.headers?.etag;
        await AsyncStorage.multiSet([
          [CACHE_KEY, JSON.stringify(response.data)],
          [ETAG_KEY, typeof newEtag === 'string' ? newEtag : ''],
        ]);
      }
      setIsOffline(false);
    } catch (err: unknown) {
      console.log('Server unreachable, switching to offline mode:', err instanceof Error ? err.message : String(err));
      setIsOffline(true);
      const cached = await readCachedSpots();
      if (cached !== null) setSpots(cached);
    }
  }, []);

  return { spots, fetchSpots, isOffline };
};
