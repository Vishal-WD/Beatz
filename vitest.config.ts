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
    // `server` included so the room store's rules are covered too: the queue
    // handoff lives there, and it was previously untestable by this runner.
    include: ['{app,components,lib,server}/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json.
    alias: { '@': resolve(__dirname, '.') },
  },
});
