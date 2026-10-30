import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/placemently-pro/' : '/',
  plugins: [react()],
  build: {
    // The local PDF.js worker is a larger, on-demand asset.
    chunkSizeWarningLimit: 1300,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules\/(?:react|react-dom|react-router-dom|scheduler)\// },
            { name: 'motion-vendor', test: /node_modules\/framer-motion\// },
            { name: 'ui-vendor', test: /node_modules\/(?:lucide-react|sonner)\// },
            { name: 'forms-vendor', test: /node_modules\/(?:react-hook-form|zod|@hookform|date-fns|zustand|dexie|@dnd-kit)\// },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
