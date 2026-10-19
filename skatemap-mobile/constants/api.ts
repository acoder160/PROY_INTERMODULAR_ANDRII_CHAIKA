const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

// Use EXPO_PUBLIC_API_URL for local development, for example:
// EXPO_PUBLIC_API_URL=http://192.168.1.39:8080
export const API_BASE_URL = (configuredApiUrl || 'https://skatemap.onrender.com').replace(/\/+$/, '');

export const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY?.trim();
