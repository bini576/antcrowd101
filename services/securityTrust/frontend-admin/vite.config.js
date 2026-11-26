import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  plugins: [react()],
  base: '/workspace/trust-admin/',
  server: {
    port: 3004,
    host: true,
    strictPort: true
  }
})
