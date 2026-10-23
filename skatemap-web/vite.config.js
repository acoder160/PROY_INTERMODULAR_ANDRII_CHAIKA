import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const productionCsp = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://res.cloudinary.com https://via.placeholder.com; connect-src 'self' https://skatemap.onrender.com https://*.cartocdn.com https://tile.openstreetmap.org; font-src 'self' data:; form-action 'self'; upgrade-insecure-requests";
const developmentCsp = productionCsp.replace(
  "connect-src 'self' https://skatemap.onrender.com",
  "connect-src 'self' http://localhost:8080 http://127.0.0.1:8080 https://skatemap.onrender.com"
);

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'content-security-policy',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          const content = mode === 'development' ? developmentCsp : productionCsp;
          return html.replace(
            '</head>',
            `    <meta http-equiv="Content-Security-Policy" content="${content}" />\n  </head>`
          );
        },
      },
    },
  ],
}));
