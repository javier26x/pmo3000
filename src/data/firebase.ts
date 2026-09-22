/**
 * Inicializacion de Firebase. Unico punto del proyecto que crea la app, el auth
 * y el Firestore. Con VITE_USAR_EMULADORES=true todo apunta al Emulator Suite y
 * jamas toca la nube (el projectId "demo-*" ademas lo garantiza del lado del SDK).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

export const AJUSTES = {
  usarEmuladores: import.meta.env.VITE_USAR_EMULADORES === 'true',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-pmo3000',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-pmo3000.firebaseapp.com',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
  dominioPermitido: (import.meta.env.VITE_DOMINIO_PERMITIDO ?? 'claro.cl').toLowerCase(),
  puertoAuth: 9099,
  puertoFirestore: 8080,
} as const

export const app: FirebaseApp = initializeApp({
  apiKey: AJUSTES.apiKey,
  authDomain: AJUSTES.authDomain,
  projectId: AJUSTES.projectId,
  appId: AJUSTES.appId,
})

export const auth: Auth = getAuth(app)

/**
 * Cache local persistente: la app tiene que seguir siendo util en terreno, donde
 * la senal se cae. Con esto, las lecturas salen del disco cuando no hay red y
 * las escrituras quedan encoladas y se sincronizan solas al volver la conexion.
 *
 * El gestor multipestana comparte una sola cache entre las pestanas abiertas.
 * Si el navegador no lo soporta (modo privado, almacenamiento bloqueado), se cae
 * a la cache en memoria: la app funciona igual, solo pierde el modo sin conexion.
 */
function crearFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (e) {
    console.warn('Sin cache persistente; se usara la cache en memoria.', e)
    return getFirestore(app)
  }
}

export const db: Firestore = crearFirestore()

if (AJUSTES.usarEmuladores) {
  connectAuthEmulator(auth, `http://127.0.0.1:${AJUSTES.puertoAuth}`, { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', AJUSTES.puertoFirestore)
}

/** Nombres de coleccion en un solo lugar: no se escriben strings sueltos por ahi. */
export const COLECCIONES = {
  usuarios: 'usuarios',
  celulas: 'celulas',
  proveedores: 'proveedores',
  portafolios: 'portafolios',
  programas: 'programas',
  proyectos: 'proyectos',
  sitios: 'sitios',
  sitioProyectos: 'sitioProyectos',
  gateTemplates: 'gateTemplates',
  tareas: 'tareas',
  auditoria: 'auditoria',
  comentarios: 'comentarios',
  raid: 'raid',
  config: 'config',
} as const
