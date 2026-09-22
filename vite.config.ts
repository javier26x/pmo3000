/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Un build de produccion sin credenciales reales no falla: los valores por
 * defecto de src/data/firebase.ts se cuelan en el bundle y el sitio publicado
 * muere recien al intentar entrar, con un "auth/api-key-not-valid" que no dice
 * nada de la causa. Preferimos romper el build, que es donde se puede arreglar.
 *
 * El archivo .env.production esta en .gitignore (trae la configuracion del
 * proyecto real), asi que un clon nuevo no lo tiene: este chequeo es el aviso.
 */
function exigirCredenciales(modo: string): void {
  const entorno = loadEnv(modo, process.cwd(), 'VITE_')

  // Un build para emuladores es legitimo, pero no en modo produccion: el .env de
  // desarrollo se carga en todos los modos, asi que sin .env.production el sitio
  // publicado quedaria hablandole a 127.0.0.1 en el computador de quien lo abre.
  if (entorno.VITE_USAR_EMULADORES === 'true') {
    if (modo !== 'production') return
    throw new Error(
      [
        'Build de produccion con VITE_USAR_EMULADORES=true.',
        '',
        'Ese valor viene de tu .env de desarrollo, que se carga en todos los modos.',
        'Crea .env.production con la configuracion del proyecto real (incluyendo',
        'VITE_USAR_EMULADORES=no) o construye con "vite build --mode development".',
      ].join('\n'),
    )
  }

  const obligatorias = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ]
  const faltan = obligatorias.filter((clave) => {
    const valor = entorno[clave]
    return valor === undefined || valor === '' || valor.startsWith('demo-')
  })
  if (faltan.length === 0) return

  throw new Error(
    [
      `Build de produccion sin configuracion de Firebase. Faltan: ${faltan.join(', ')}.`,
      '',
      `Crea el archivo .env.${modo} con los datos del proyecto (los saca la consola de`,
      'Firebase en Configuracion del proyecto > Tus aplicaciones > SDK setup) o, si lo que',
      'querias era un build contra los emuladores, agrega VITE_USAR_EMULADORES=true.',
      '',
      'El README lo explica en la seccion "Desplegar a la nube".',
    ].join('\n'),
  )
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') exigirCredenciales(mode)

  return {
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
          codeSplitting: {
            // Solo Firebase. Un grupo "vendor" genérico arrastraría Leaflet y
            // SheetJS al trozo inicial y perderíamos la carga bajo demanda.
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
  }
})
