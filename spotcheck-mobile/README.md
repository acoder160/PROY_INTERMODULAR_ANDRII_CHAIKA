# SpotCheck — mobile

Expo (React Native, TypeScript, expo-router) client for SpotCheck, built for Android with EAS.
It has:
- a Leaflet map in a WebView;
- the **photo-first add-spot flow** (camera → pin inside your GPS radius → details);
- an offline spot cache with ETag revalidation;
- Google sign-in;
- swipe-card admin moderation.

The whole project is described in the [root README](../README.md).

```bash
npm install
npx expo start         # Expo Go, emulator or web
npx tsc --noEmit       # type-check
npm run lint
```

## Environment (`.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API origin. On a phone use your computer's LAN IP, e.g. `http://192.168.1.20:8080` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID (browser flow with PKCE) |
| `EXPO_PUBLIC_CARTO_API_KEY` | Optional CARTO tiles key; falls back to OpenStreetMap tiles |
| `EXPO_PUBLIC_DEMO_ENABLED` | `true` shows **Try the demo** on the login screen (backend needs `DEMO_ENABLED=true`) |
| `EXPO_PUBLIC_WEB_URL` | Web app URL, used to open the legal page |

Photos upload straight to Cloudinary with parameters the backend signs for each user. No
Cloudinary preset or secret lives in the app.

Translations are generated: edit `../i18n/locales/*.json`, then run `node ../i18n/sync.mjs`.
