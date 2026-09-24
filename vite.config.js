import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The faculty console calls the Express API (npm run server) through this proxy.
const proxy = { '/api': `http://localhost:${process.env.API_PORT || 8787}` }

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
