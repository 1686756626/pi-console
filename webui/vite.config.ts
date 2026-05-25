import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:7002',
        changeOrigin: true,
      },
    },
    allowedHosts: ['.monkeycode-ai.online'],
  },
  build: {
    cssMinify: false,
  },
})
