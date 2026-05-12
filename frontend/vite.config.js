import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Split vendor libs into their own chunks so:
    //   1. The landing page doesn't ship the entire app shell to anonymous
    //      visitors (achieved by route-level React.lazy in App.jsx).
    //   2. Returning visitors hit a cached vendor bundle even after we
    //      ship app-code-only updates.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
        },
      },
    },
    // We've audited the largest chunks (framer-motion at ~150 kB gz). Lift
    // the warning threshold so a routine build doesn't print a scary
    // orange warning every time.
    chunkSizeWarningLimit: 800,
  },
})
