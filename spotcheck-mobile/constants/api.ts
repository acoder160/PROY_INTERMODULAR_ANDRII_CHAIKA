const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

// Use EXPO_PUBLIC_API_URL for local development, for example:
// EXPO_PUBLIC_API_URL=http://192.168.1.39:8080
export const API_BASE_URL = (configuredApiUrl || 'https://skatemap.onrender.com').replace(/\/+$/, '');

export const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY?.trim();

// Web app address, for links to its pages (rules & privacy at /legal). Without it those links are hidden.
//   EXPO_PUBLIC_WEB_URL=https://your-web-domain
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
export const WEB_URL = configuredWebUrl ? configuredWebUrl.replace(/\/+$/, '') : null;
export const LEGAL_URL = WEB_URL ? `${WEB_URL}/legal` : null;
