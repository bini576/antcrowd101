import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  plugins: [react(), tailwindcss()],
  base: '/workspace/challenge/',
  server: {
    port: 3000,
    host: true,
    strictPort: true
  }
})
