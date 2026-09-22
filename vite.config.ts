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

  // Cada variable trae la forma que debe tener. No es purismo: un valor copiado
  // desde un chat o un ticket que enmascara secretos llega con caracteres que no
  // existen en una credencial de Google ("AIzaSyDs•••••"), pasa cualquier chequeo
  // de "no esta vacio" y recien falla en el navegador con auth/api-key-not-valid,
  // que no dice nada de la causa.
  const esperadas = [
    {
      clave: 'VITE_FIREBASE_API_KEY',
      forma: /^AIza[0-9A-Za-z_-]{35}$/,
      descripcion: '"AIza" y 35 caracteres mas (39 en total)',
    },
    {
      clave: 'VITE_FIREBASE_AUTH_DOMAIN',
      forma: /^[a-z0-9-]+\.(firebaseapp\.com|web\.app)$/,
      descripcion: 'algo.firebaseapp.com',
    },
    {
      clave: 'VITE_FIREBASE_PROJECT_ID',
      forma: /^[a-z][a-z0-9-]{4,29}$/,
      descripcion: 'el id del proyecto en minusculas',
    },
    {
      clave: 'VITE_FIREBASE_APP_ID',
      forma: /^\d+:\d+:web:[0-9a-f]+$/,
      descripcion: '1:123456789:web:abc123',
    },
  ]

  const faltan = esperadas
    .filter(({ clave }) => {
      const valor = entorno[clave]
      return valor === undefined || valor === '' || valor.startsWith('demo-')
    })
    .map(({ clave }) => clave)

  const deformes = esperadas
    .filter(({ clave, forma }) => {
      const valor = entorno[clave]
      return valor !== undefined && valor !== '' && !valor.startsWith('demo-') && !forma.test(valor)
    })
    .map(({ clave, descripcion }) => `  ${clave}: se esperaba ${descripcion}`)

  if (faltan.length === 0 && deformes.length === 0) return

  const detalle = [
    ...(faltan.length > 0 ? [`Faltan: ${faltan.join(', ')}.`] : []),
    ...(deformes.length > 0 ? ['Tienen un valor que no calza:', ...deformes] : []),
  ]

  throw new Error(
    [
      'Build de produccion con la configuracion de Firebase incompleta o invalida.',
      '',
      ...detalle,
      '',
      `Lo mas seguro es generar .env.${modo} desde el proyecto mismo en vez de copiar`,
      'los valores a mano: el README lo explica en la seccion "Desplegar a la nube",',
      'y el comando es "npm run env:produccion".',
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
