import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';

const REFRESH_TOKEN_KEY = 'skatemap_refresh_token';

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
type QueueEntry = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let accessToken: string | null = null;
let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error('Refresh token is unavailable'));
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const saveRefreshToken = async (token: string) => {
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
};

export const getRefreshToken = () => (
  Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
);

export const clearSession = async () => {
  accessToken = null;
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

export const refreshSession = async () => {
  const refreshToken = await getRefreshToken();
  if (Platform.OS !== 'web' && !refreshToken) {
    throw new Error('Refresh token is unavailable');
  }

  const response = await api.post(
    '/auth/refresh',
    Platform.OS === 'web' ? undefined : { refreshToken },
  );
  const nextAccessToken = response.data.token;
  const nextRefreshToken = response.data.refreshToken;

  if (!nextAccessToken || (Platform.OS !== 'web' && !nextRefreshToken)) {
    throw new Error('Refresh response is incomplete');
  }

  setAccessToken(nextAccessToken);
  if (nextRefreshToken) {
    await saveRefreshToken(nextRefreshToken);
  }

  return response;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: Platform.OS === 'web',
  headers: {
    'Content-Type': 'application/json',
    ...(Platform.OS === 'web' ? {} : { 'X-Client-Type': 'mobile' }),
    'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const url = originalRequest?.url ?? '';

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await refreshSession();
      const nextAccessToken = response.data.token;
      processQueue(null, nextAccessToken);

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      await clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
