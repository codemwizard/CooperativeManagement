import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  preview: { port: 5174 },
  define: {
    // Ensure VITE_DEMO is available at build time for tree-shaking
    'import.meta.env.VITE_DEMO': JSON.stringify(process.env.VITE_DEMO ?? 'false'),
  },
});

