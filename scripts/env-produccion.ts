/**
 * Genera .env.production leyendo la configuracion del proyecto real desde la CLI
 * de Firebase, en vez de copiarla a mano.
 *
 * El motivo es concreto: la configuracion web de Firebase se copia habitualmente
 * desde la consola, un chat o un ticket, y varias de esas herramientas enmascaran
 * lo que parece un secreto. Una apiKey que llega como "AIzaSyDs•••••" se ve bien
 * a simple vista, pasa un chequeo de "no esta vacia" y produce un sitio que
 * compila, se despliega y recien falla al entrar con auth/api-key-not-valid.
 * Pedirle los valores al proyecto elimina la transcripcion humana del camino.
 *
 * Uso: npm run env:produccion
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ALIAS = 'produccion'
const ARCHIVO = '.env.production'

/** Valores que son decision nuestra, no del proyecto, y que se conservan si ya estan. */
const PROPIOS = {
  VITE_DOMINIO_PERMITIDO: 'clarovtr.cl',
  VITE_CORREOS_ADMIN: '',
} as const

interface ConfiguracionWeb {
  apiKey?: string
  authDomain?: string
  projectId?: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

function firebase(argumentos: string[]): unknown {
  let salida: string
  try {
    salida = execFileSync('firebase', [...argumentos, '--project', ALIAS, '--json'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      // En Windows la CLI es firebase.cmd y solo se encuentra a traves del shell.
      // Los argumentos son fijos (no vienen del usuario), asi que no hay inyeccion.
      shell: process.platform === 'win32',
    })
  } catch (e) {
    // En Windows con Node 24 la CLI a veces se cae al CERRAR (assertion de libuv)
    // despues de haber escrito la respuesta completa. Si stdout trae un JSON con
    // status "success", la respuesta es valida; cualquier otro caso es un error.
    const stdout = (e as { stdout?: string }).stdout ?? ''
    try {
      const datos = JSON.parse(stdout) as { status?: string }
      if (datos.status === 'success') return datos
    } catch {
      // stdout no era JSON: se relanza el error original.
    }
    throw e
  }
  return JSON.parse(salida)
}

function idDeLaApp(): string {
  const respuesta = firebase(['apps:list', 'WEB']) as {
    result?: { appId?: string; displayName?: string }[]
  }
  const apps = respuesta.result ?? []
  if (apps.length === 0) {
    throw new Error(
      'El proyecto no tiene ninguna app web registrada. Creala con:\n' +
        `  firebase apps:create WEB "PMO3000" --project ${ALIAS}`,
    )
  }
  const primera = apps[0]
  if (apps.length > 1) {
    console.warn(
      `El proyecto tiene ${apps.length} apps web; se usa la primera ` +
        `(${primera?.displayName ?? primera?.appId}).`,
    )
  }
  const id = primera?.appId
  if (id === undefined) throw new Error('La CLI devolvio una app sin appId.')
  return id
}

function configuracion(appId: string): ConfiguracionWeb {
  const respuesta = firebase(['apps:sdkconfig', 'WEB', appId]) as {
    result?: { sdkConfig?: ConfiguracionWeb }
  }
  const config = respuesta.result?.sdkConfig
  if (config === undefined) throw new Error('La CLI no devolvio sdkConfig.')
  return config
}

/** Lo que ya haya en el archivo manda sobre el valor por defecto: es configuracion local. */
function valoresPropiosActuales(): Record<string, string> {
  const actuales: Record<string, string> = { ...PROPIOS }
  if (!existsSync(ARCHIVO)) return actuales
  for (const linea of readFileSync(ARCHIVO, 'utf8').split('\n')) {
    const corte = linea.indexOf('=')
    if (corte <= 0 || linea.trimStart().startsWith('#')) continue
    const clave = linea.slice(0, corte).trim()
    if (clave in actuales) actuales[clave] = linea.slice(corte + 1).trim()
  }
  return actuales
}

function exigir(config: ConfiguracionWeb, clave: keyof ConfiguracionWeb): string {
  const valor = config[clave]
  if (valor === undefined || valor === '') {
    throw new Error(`La configuracion del proyecto no trae "${clave}".`)
  }
  return valor
}

function main(): void {
  console.log(`Leyendo la configuracion del alias "${ALIAS}" desde Firebase…`)
  const config = configuracion(idDeLaApp())
  const propios = valoresPropiosActuales()

  const lineas = [
    '# Generado por: npm run env:produccion',
    '# No se versiona (esta en .gitignore). Para regenerarlo, vuelve a correr ese comando.',
    '',
    'VITE_USAR_EMULADORES=false',
    `VITE_FIREBASE_API_KEY=${exigir(config, 'apiKey')}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${exigir(config, 'authDomain')}`,
    `VITE_FIREBASE_PROJECT_ID=${exigir(config, 'projectId')}`,
    `VITE_FIREBASE_APP_ID=${exigir(config, 'appId')}`,
    ...(config.storageBucket ? [`VITE_FIREBASE_STORAGE_BUCKET=${config.storageBucket}`] : []),
    ...(config.messagingSenderId
      ? [`VITE_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}`]
      : []),
    '',
    '# Politica de acceso. VITE_CORREOS_ADMIN tiene que decir lo mismo que',
    '# correosAdministradores() en firestore.rules.',
    `VITE_DOMINIO_PERMITIDO=${propios.VITE_DOMINIO_PERMITIDO}`,
    `VITE_CORREOS_ADMIN=${propios.VITE_CORREOS_ADMIN}`,
    '',
  ]

  writeFileSync(ARCHIVO, lineas.join('\n'))
  console.log(`\n${ARCHIVO} escrito para el proyecto "${exigir(config, 'projectId')}".`)
  console.log(`Dominio permitido: ${propios.VITE_DOMINIO_PERMITIDO}`)
  console.log(
    `Correos admin: ${propios.VITE_CORREOS_ADMIN === '' ? '(ninguno)' : propios.VITE_CORREOS_ADMIN}`,
  )
  if (propios.VITE_CORREOS_ADMIN === '') {
    console.log(
      '\nNo hay correos admin. Si necesitas entrar con una cuenta externa,\n' +
        `agrega la linea VITE_CORREOS_ADMIN=tu@correo.com a ${ARCHIVO}\n` +
        'y la misma direccion en correosAdministradores() de firestore.rules.',
    )
  }
}

main()
