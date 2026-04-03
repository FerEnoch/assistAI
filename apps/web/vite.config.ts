import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactRouter } from '@react-router/dev/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    reactRouter(),
  ],
  // Monorepo: load env vars from repository root (.env)
  envDir: path.resolve(process.cwd(), '../../'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
