import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // mapbox-gl is big but only loaded when a token is set.
  build: { chunkSizeWarningLimit: 2000 },
})
