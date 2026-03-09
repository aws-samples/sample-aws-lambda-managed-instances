import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config
// Deployed via GitHub Pages
export default defineConfig(() => ({
  plugins: [react()],
  base: '/sample-aws-lambda-managed-instances/', // GitHub Pages repository name
  build: {
    outDir: 'dist',
  },
}))
