import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [repoRoot] }, // allow importing the shared theme package
  },
});
