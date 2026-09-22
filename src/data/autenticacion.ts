/**
 * Autenticación.
 *
 * Tres formas de entrar, todas contra la misma política de acceso:
 *
 * - **Enlace por correo** (sin contraseña): el camino del equipo con cuenta
 *   corporativa @clarovtr.cl.
 * - **Google**: para las cuentas autorizadas de la lista y para quien tenga su
 *   correo corporativo en Google Workspace.
 * - **Contraseña**: solo contra los emuladores, como atajo de desarrollo.
 *
 * Todo pasa por `validarAcceso()`, y lo mismo se valida en firestore.rules. Si
 * alguien entra con un método nuevo y su correo no está autorizado, se le cierra
 * la sesión de inmediato: quedar autenticado pero sin poder leer nada es el peor
 * de los estados, porque parece un error de la aplicación.
 */
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { AJUSTES, auth } from './firebase'
import {
  esAccesoPermitido,
  mensajeAccesoDenegado,
  normalizarEmail,
  rolInicial,
  type PoliticaAcceso,
} from '@/domain/permisos/dominio'
import type { Rol } from '@/domain/tipos/comunes'

const CLAVE_CORREO = 'pmo3000.correoPendiente'

export type MetodoIngreso = 'enlace_correo' | 'google' | 'password_dev'

export const POLITICA: PoliticaAcceso = {
  dominio: AJUSTES.dominioPermitido,
  correosAdmin: AJUSTES.correosAdmin,
}

/** Lo único del entorno que necesita la interfaz. */
export const AJUSTES_AUTENTICACION = {
  usarEmuladores: AJUSTES.usarEmuladores,
  dominioPermitido: AJUSTES.dominioPermitido,
  correosAdmin: AJUSTES.correosAdmin,
} as const

export function dominioPermitido(): string {
  return AJUSTES.dominioPermitido
}

export function puedeEntrar(email: string): boolean {
  return esAccesoPermitido(email, POLITICA)
}

/** Rol con el que se crea el perfil en el primer ingreso. */
export function rolInicialDe(email: string): Rol {
  return rolInicial(email, POLITICA)
}

export function validarAcceso(email: string): void {
  if (!puedeEntrar(email)) {
    throw new Error(mensajeAccesoDenegado(POLITICA))
  }
}

export function observarSesion(cb: (usuario: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}

// --- Enlace por correo -----------------------------------------------------

export async function enviarEnlaceIngreso(email: string): Promise<void> {
  const correo = normalizarEmail(email)
  validarAcceso(correo)

  await sendSignInLinkToEmail(auth, correo, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  })

  try {
    window.localStorage.setItem(CLAVE_CORREO, correo)
  } catch {
    // Modo privado sin localStorage: se le pedirá el correo de nuevo al volver.
  }
}

export function correoPendiente(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_CORREO)
  } catch {
    return null
  }
}

export function hayEnlaceEnUrl(): boolean {
  return isSignInWithEmailLink(auth, window.location.href)
}

export async function completarIngresoConEnlace(emailProporcionado?: string): Promise<User> {
  const correo = normalizarEmail(emailProporcionado ?? correoPendiente() ?? '')
  if (!correo) {
    throw new Error('Necesitamos tu correo para completar el ingreso desde este dispositivo')
  }
  validarAcceso(correo)

  const credencial = await signInWithEmailLink(auth, correo, window.location.href)
  try {
    window.localStorage.removeItem(CLAVE_CORREO)
  } catch {
    // sin localStorage no hay nada que limpiar
  }
  return credencial.user
}

// --- Google ----------------------------------------------------------------

/**
 * Ingreso con Google. A diferencia del enlace por correo, aquí el correo se
 * conoce recién después de autenticar, así que si no está autorizado hay que
 * deshacer la sesión antes de devolver el error.
 */
export async function ingresarConGoogle(): Promise<User> {
  const proveedor = new GoogleAuthProvider()
  // Fuerza el selector de cuenta: mucha gente tiene varias sesiones de Google
  // abiertas y entrar con la equivocada es el error más común.
  proveedor.setCustomParameters({ prompt: 'select_account' })

  const credencial = await signInWithPopup(auth, proveedor)
  const correo = credencial.user.email ?? ''

  if (!puedeEntrar(correo)) {
    await signOut(auth)
    throw new Error(`La cuenta ${correo} no está autorizada. ${mensajeAccesoDenegado(POLITICA)}`)
  }
  return credencial.user
}

// --- Atajo de desarrollo ---------------------------------------------------

export async function ingresarComoUsuarioDemo(email: string, password: string): Promise<User> {
  if (!AJUSTES.usarEmuladores) {
    throw new Error('El ingreso directo solo existe con los emuladores')
  }
  validarAcceso(email)
  const credencial = await signInWithEmailAndPassword(auth, normalizarEmail(email), password)
  return credencial.user
}

export async function cerrarSesion(): Promise<void> {
  await signOut(auth)
}

/** Usuarios de ejemplo que publica el seed para el atajo de desarrollo. */
export interface UsuarioDemo {
  email: string
  password: string
  nombre: string
  rol: string
  proveedor: string | null
}

export async function usuariosDemo(): Promise<UsuarioDemo[]> {
  if (!AJUSTES.usarEmuladores) return []
  try {
    const respuesta = await fetch('/dev-usuarios.json', { cache: 'no-store' })
    if (!respuesta.ok) return []
    const datos: unknown = await respuesta.json()
    return Array.isArray(datos) ? (datos as UsuarioDemo[]) : []
  } catch {
    return []
  }
}
