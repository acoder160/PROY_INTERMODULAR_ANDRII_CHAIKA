import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';

interface UnreadContextType {
  unread: number;
  refresh: () => void;
  clear: () => void;
}

const UnreadContext = createContext<UnreadContextType>({ unread: 0, refresh: () => {}, clear: () => {} });

/** One unread counter for the whole app: the tab badge shows it, the notifications screen clears it. */
export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const value = useUnreadCount(Boolean(user));
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
