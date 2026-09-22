/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // El SDK de Firebase pesa ~550 kB sin comprimir y no hay como partirlo mas.
    chunkSizeWarningLimit: 700,
    // Los modulos pesados (mapa, importador, PPT en Fase 2) se cargan bajo
    // demanda con import() dinamico; ver rutas.tsx y src/data/archivos.ts.
    // Firebase va en su propio trozo: cambia mucho menos que el codigo de la
    // app, asi que se cachea aparte en el navegador.
    rolldownOptions: {
      output: {
        advancedChunks: {
          // Solo Firebase. Un grupo "vendor" generico arrastraria Leaflet y
          // SheetJS al trozo inicial y perderiamos la carga bajo demanda.
          groups: [{ name: 'firebase', test: /node_modules[\\/]@?firebase/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/pruebas/setup.ts'],
  },
})
