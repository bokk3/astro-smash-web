import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@babylonjs/core': path.resolve(__dirname, 'node_modules/babylonjs/babylon.js'),
      '@babylonjs/materials': path.resolve(__dirname, 'node_modules/babylonjs-materials/babylonjs.materials.min.js')
    }
  },
  server: {
    port: 5174,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 10000,
    reportCompressedSize: false,
    sourcemap: false
  }
});
