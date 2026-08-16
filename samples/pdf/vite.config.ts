import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname),
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../..'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5179,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['pdfjs'],
  },
})
