import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The brand UI talks only to its own backend (the BFF), never to RAGFlow
// directly. We proxy /bff -> backend (localhost:7071, matching PORT in
// myui-backend/.env) so the browser sees same-origin requests (no CORS) and the
// SSE answer stream passes through untouched. The backend, in turn, proxies to
// RAGFlow and logs every Q&A.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/bff': {
        target: 'http://localhost:7071',
        changeOrigin: true,
        // Disable buffering so Server-Sent Events arrive incrementally.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
    },
  },
});
