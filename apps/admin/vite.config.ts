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
      '@ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@validation': path.resolve(__dirname, '../../packages/validation/src'),
    },
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
