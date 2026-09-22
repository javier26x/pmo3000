import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Configuracion aparte: los tests de reglas corren en Node contra el emulador
// de Firestore, no en jsdom. Se ejecutan con `npm run test:rules`.
export default defineConfig({
  // Los tests de reglas importan del dominio (la plantilla estandar, para armar
  // documentos de prueba realistas), y el dominio usa el alias.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
