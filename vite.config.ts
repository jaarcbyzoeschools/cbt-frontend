import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Where the Express backend runs during development.
  // Override with BACKEND_URL in .env if it's on another machine.
  const backend = env.BACKEND_URL || 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],

    server: {
      // Listen on the LAN too, so other PCs can test the dev build
      // at http://<this-PC's-IP>:5173
      host: true,

      // The app calls relative URLs (/api/..., /uploads/...).
      // In dev, forward those to the backend so it behaves exactly
      // like production, where Express serves both.
      proxy: {
        '/api': backend,
        '/uploads': backend,
      },
    },
  }
})
