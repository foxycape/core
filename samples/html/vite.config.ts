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
    // Windows: Vite may bind only to ::1; browsers/tools hitting 127.0.0.1 then fail.
    host: '127.0.0.1',
    port: 5178,
    open: true,
  },
})
