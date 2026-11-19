import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Pre-bundle the big, tab-only libraries at server start instead of letting
  // Vite discover them mid-session (which triggers a full page reload).
  optimizeDeps: {
    include: ['jspdf', 'html-to-image', 'leaflet', '@supabase/supabase-js'],
  },
  server: {
    host: true,
    allowedHosts: true,
    // Transform lazy tab modules up front so switching tabs is instant.
    warmup: {
      clientFiles: [
        './src/components/*.jsx',
        './src/suthra-punjab-portal/*.jsx',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Only split the libraries needed for the very first paint. Heavy,
        // tab-only libraries (jspdf, html-to-image, leaflet) are left alone so
        // Rollup keeps them inside the lazy tab chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react') || id.includes('scheduler')) {
            return 'vendor-react'
          }
          // Everything else (jspdf, html-to-image, leaflet, ...) is left to
          // Rollup so it stays inside the lazy tab chunks.
          return undefined
        },
      },
    },
  },
})
