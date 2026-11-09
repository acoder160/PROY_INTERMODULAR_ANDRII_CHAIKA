import axios from 'axios';
import i18n from '../i18n';

let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

export const clearAccessToken = () => {
    accessToken = null;
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        config.headers['Accept-Language'] = i18n.language || 'en';
        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * One refresh at a time. Refresh tokens rotate and the server treats a reused one as stolen
 * (it revokes the whole session family), so two parallel refreshes with the same cookie (React
 * StrictMode running the restore effect twice, or a 401 arriving while the restore is in flight)
 * would sign the user out. Everyone waiting shares the same request instead.
 */
let refreshInFlight = null;
export const refreshSession = () => {
    if (!refreshInFlight) {
        refreshInFlight = api.post('/auth/refresh')
            .then((response) => {
                setAccessToken(response.data.token);
                return response;
            })
            .finally(() => { refreshInFlight = null; });
    }
    return refreshInFlight;
};

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status !== 401 ||
            !originalRequest ||
            originalRequest?._retry ||
            originalRequest?.url?.includes('/auth/login') ||
            originalRequest?.url?.includes('/auth/google') ||
            originalRequest?.url?.includes('/auth/refresh') ||
            originalRequest?.url?.includes('/auth/logout')) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((token) => {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const response = await refreshSession();
            const token = response.data.token;
            processQueue(null, token);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError);
            clearAccessToken();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
