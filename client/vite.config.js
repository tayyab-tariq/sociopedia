import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        // changeOrigin: true,
        target: 'http://localhost:3000',
        // secure: true,
      },
    },
  },

  plugins: [react()],
});
