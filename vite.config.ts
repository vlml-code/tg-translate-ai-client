import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Include specific polyfills for Node.js modules
      include: ['buffer', 'crypto', 'stream', 'util', 'path', 'os', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3000,
    warmup: {
      clientFiles: ['./src/components/*.tsx', './src/services/*.ts']
    }
  },
  optimizeDeps: {
    include: ['telegram', 'telegram/sessions', 'telegram/Password']
  }
})
