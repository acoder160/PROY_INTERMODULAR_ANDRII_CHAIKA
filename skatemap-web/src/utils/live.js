import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import api, { getAccessToken } from '../api/axiosConfig';
import { API_ORIGIN } from './social';

// ws(s)://api-host/ws: same host as the REST API
export const LIVE_SOCKET_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/ws`;

/**
 * How many skaters are checked in at each spot, kept live: one REST call for the first paint, then
 * the server pushes every change over STOMP. The client reconnects on its own after a drop and
 * re-reads the counts, so nothing missed while offline stays wrong.
 * Returns a Map spotId → count (spots with nobody are absent).
 */
export function useLiveCounts() {
  const [counts, setCounts] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const load = () => api.get('/spots/live')
      .then((res) => {
        if (!cancelled) setCounts(new Map(res.data.map((s) => [s.spotId, s.count])));
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
      onConnect: () => {
        load();
        client.subscribe('/topic/live', (frame) => {
          const { spotId, count } = JSON.parse(frame.body);
          setCounts((prev) => {
            if ((prev.get(spotId) ?? 0) === count) return prev;
            const next = new Map(prev);
            if (count > 0) next.set(spotId, count); else next.delete(spotId);
            return next;
          });
        });
      },
    });
    load();
    client.activate();
    return () => {
      cancelled = true;
      client.deactivate();
    };
  }, []);

  return counts;
}

/** "Sat 14, 18:00" in the UI language and the viewer's time zone. */
export const formatSessionTime = (iso, lang) =>
  new Date(iso).toLocaleString(lang || undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
