import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Set BASE_PATH=/myaccount/ when building for the merged eearny.pages.dev deploy
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5174,
    fs: { allow: [repoRoot] }, // allow importing the shared theme package
  },
});
