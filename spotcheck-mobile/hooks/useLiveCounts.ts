import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Client } from '@stomp/stompjs';
import api, { getAccessToken } from '../utils/api';
import { API_BASE_URL } from '../constants/api';

const LIVE_SOCKET_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;

/**
 * Skaters checked in at each spot, kept live: one REST call for the first paint, then the server
 * pushes every change over STOMP. The socket closes in the background (no battery spent on a map
 * nobody sees) and reconnects, re-reading the counts, when the app comes back.
 */
export function useLiveCounts(): Record<number, number> {
  const [counts, setCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => api.get('/spots/live')
      .then((res) => {
        if (cancelled) return;
        const next: Record<number, number> = {};
        (res.data as { spotId: number; count: number }[]).forEach((s) => { next[s.spotId] = s.count; });
        setCounts(next);
      })
      .catch(() => {});

    // The JWT is optional (guests see the map too). If the server refuses it (expired), retry as a guest.
    let sendToken = true;
    const client = new Client({
      brokerURL: LIVE_SOCKET_URL,
      beforeConnect: () => {
        const token = getAccessToken();
        client.connectHeaders = sendToken && token ? { Authorization: `Bearer ${token}` } : {};
      },
      onStompError: () => { sendToken = false; },
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      // React Native's WebSocket needs these two for STOMP frames to arrive whole
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        load();
        client.subscribe('/topic/live', (frame) => {
          const { spotId, count } = JSON.parse(frame.body) as { spotId: number; count: number };
          setCounts((prev) => {
            if ((prev[spotId] ?? 0) === count) return prev;
            const next = { ...prev };
            if (count > 0) next[spotId] = count; else delete next[spotId];
            return next;
          });
        });
      },
    });
    load();
    client.activate();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !client.active) client.activate();
      if (state === 'background' && client.active) client.deactivate();
    });
    return () => {
      cancelled = true;
      sub.remove();
      client.deactivate();
    };
  }, []);

  return counts;
}
