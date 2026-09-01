import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // scripts/ holds one-shot pipelines, not tests.
    include: ['{app,components,lib}/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json.
    alias: { '@': resolve(__dirname, '.') },
  },
});
