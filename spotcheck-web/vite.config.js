import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const productionCsp = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://res.cloudinary.com https://via.placeholder.com; connect-src 'self' https://accounts.google.com/gsi/ __API__ https://*.cartocdn.com https://tile.openstreetmap.org; font-src 'self' data:; form-action 'self'; upgrade-insecure-requests";
// The API origin and its WebSocket (live map counts), from VITE_API_URL
const apiSources = (apiUrl) => {
  const origin = new URL(apiUrl || 'http://localhost:8080/api').origin;
  return `${origin} ${origin.replace(/^http/, 'ws')}`;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const csp = productionCsp.replace('__API__', apiSources(env.VITE_API_URL));
  return {
  plugins: [
    react(),
    {
      name: 'content-security-policy',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          const content = mode === 'development'
            ? csp.replace("connect-src 'self'", "connect-src 'self' http://localhost:8080 ws://localhost:8080 http://127.0.0.1:8080 ws://127.0.0.1:8080")
            : csp;
          return html.replace(
            '</head>',
            `    <meta http-equiv="Content-Security-Policy" content="${content}" />\n  </head>`
          );
        },
      },
    },
  ],
  };
});
