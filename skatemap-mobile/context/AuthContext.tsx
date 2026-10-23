// context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import api, {
  clearSession,
  getRefreshToken,
  refreshSession,
  saveRefreshToken,
  setAccessToken,
} from '../utils/api';

// Definimos la estructura del contexto
interface AuthContextType {
  user: string | null;
  token: string | null;
  login: (username: string, token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (Platform.OS !== 'web' && !refreshToken) return;

        const response = await refreshSession();
        setToken(response.data.token);
        setUser(response.data.username);
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (username: string, jwtToken: string, refreshToken?: string) => {
    setAccessToken(jwtToken);
    if (refreshToken) {
      await saveRefreshToken(refreshToken);
    }
    setUser(username);
    setToken(jwtToken);
  };

  const logout = async () => {
    try {
      const refreshToken = await getRefreshToken();
      await api.post(
        '/auth/logout',
        Platform.OS === 'web' ? undefined : (refreshToken ? { refreshToken } : undefined),
      );
    } finally {
      await clearSession();
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
};