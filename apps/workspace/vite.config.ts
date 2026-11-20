import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/auth': { target: process.env.VITE_AUTH_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: false },
      '^/workspace/context$': { target: process.env.VITE_AUTH_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: false },
      '/workspace/verified-findings': { target: process.env.VITE_AUTH_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: false },
    },
  },
  preview: { port: 5174 },
  define: {
    // Ensure VITE_DEMO is available at build time for tree-shaking
    'import.meta.env.VITE_DEMO': JSON.stringify(process.env.VITE_DEMO ?? 'false'),
  },
});

