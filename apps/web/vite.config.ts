import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': path.resolve(__dirname, '../../packages/contracts/src'),
      '@builder-core': path.resolve(__dirname, '../../packages/builder-core/src'),
      '@runtime-renderer': path.resolve(__dirname, '../../packages/runtime-renderer/src'),
      '@animation-runtime': path.resolve(__dirname, '../../packages/animation-runtime/src'),
      '@ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@validation': path.resolve(__dirname, '../../packages/validation/src'),
    },
  },
  build: {
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
