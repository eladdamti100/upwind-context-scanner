import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Single config source: Vite (dev/build) + Vitest (test) live here.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
