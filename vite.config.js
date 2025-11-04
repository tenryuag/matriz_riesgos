import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true
  },
  preview: {
    port: 4173,
    strictPort: false,
    // Configuración para SPA - redirigir todas las rutas a index.html
    proxy: {
      '/': {
        target: 'http://localhost:4173',
        bypass: (req) => {
          if (req.url.indexOf('.') === -1) {
            return '/index.html'
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 