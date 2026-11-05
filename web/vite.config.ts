import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NUI pages are served from nui://, so every asset path has to be relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
