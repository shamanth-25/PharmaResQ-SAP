import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',

    proxy: {
      '/pharma': {
        target: 'http://localhost:4004',
        changeOrigin: true
      }
    }
  }
})