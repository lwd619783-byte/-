import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { demoBoundary } from './scripts/demo-boundary.mjs';

// A separate root prevents the formal app and public/ data from being copied.
// No local SQLite, portfolio, review or sharing middleware is installed.
export default defineConfig({
  root: 'demo', base: './', publicDir: false, envDir: false, envPrefix: [],
  plugins: [react(), demoBoundary()],
  build: { outDir: '../dist-demo', emptyOutDir: true, sourcemap: false },
});
