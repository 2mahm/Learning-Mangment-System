import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = 'https://learning-mangment-system-production.up.railway.app'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/media': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})