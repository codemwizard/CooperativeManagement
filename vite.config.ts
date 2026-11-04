import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data': path.resolve(__dirname, './data')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  // Vitest configuration (isolated to unit/engine tests)
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
} as any);
