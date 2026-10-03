import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Backend the dev server proxies /api to. Defaults to the local backend; inside
// a container set KLYRA_API_PROXY_TARGET=http://backend:4000 so the proxy does
// not accidentally call localhost (which is the frontend container itself).
const apiProxyTarget = process.env.KLYRA_API_PROXY_TARGET || 'http://localhost:4000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
