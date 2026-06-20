import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // encaminha chamadas /api para o backend em dev
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
