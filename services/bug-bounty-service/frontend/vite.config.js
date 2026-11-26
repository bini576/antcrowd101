import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  plugins: [react(), tailwindcss()],
  base: '/workspace/bug-bounty/',
  server: {
    port: 3002,
    host: true,
    strictPort: true
  }
})
