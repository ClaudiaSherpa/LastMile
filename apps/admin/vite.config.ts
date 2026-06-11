import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3100', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3100', ws: true, changeOrigin: true },
    },
  },
});
