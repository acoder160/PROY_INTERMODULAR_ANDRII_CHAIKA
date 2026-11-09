import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import api from '../utils/api';

/**
 * Unread notifications for the tab badge: checked on sign-in, every minute while the app is in
 * the foreground, and whenever it comes back to it. {@code refresh} lets a screen re-check at once.
 */
export function useUnreadCount(enabled: boolean) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    api.get('/notifications/unread-count')
      .then((res) => setUnread(res.data?.unread ?? 0))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 60000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, refresh]);

  return { unread: enabled ? unread : 0, refresh, clear: () => setUnread(0) };
}
