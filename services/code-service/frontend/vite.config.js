import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  plugins: [react(), tailwindcss()],
  base: '/workspace/code/',
  server: {
    port: 3003,
    host: true,
    strictPort: true
  }
})
