# SpotCheck — web

React 19 + Vite client for SpotCheck. It has:
- a full-screen Leaflet map with clustering and filters;
- spot details with ratings and comments;
- reporting;
- Google sign-in;
- the admin moderation queue.

The whole project is described in the [root README](../README.md).

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # static files in dist/
```

## Environment (`.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base, e.g. `http://localhost:8080/api` (default) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth web client ID; the Google button is hidden without it |
| `VITE_CARTO_API_KEY` | Optional CARTO tiles key; falls back to OpenStreetMap tiles |
| `VITE_DEMO_ENABLED` | `true` shows **Try the demo** on the login page (backend needs `DEMO_ENABLED=true`) |
| `VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL` | Shown on the `/legal` page |

Translations are generated: edit `../i18n/locales/*.json`, then run `node ../i18n/sync.mjs`.
