/**
 * Vite config: React plugin, dev server (port 3000, HMR), build (dist, esbuild minify, banner).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild', // Use esbuild (Vite default) for fast minification
    rollupOptions: {
      output: {
        banner: `/*! Copyright (c) 2026 InfiniteSpecies. All Rights Reserved. Proprietary Software. Unauthorized copying, modification, distribution, or use is strictly prohibited. */`,
        // Compact output for better obfuscation
        compact: true
      }
    }
  }
})
