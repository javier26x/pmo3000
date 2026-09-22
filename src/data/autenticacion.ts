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
 * Entra quien tenga correo del dominio, quien este en la lista de
 * administradores y quien tenga una invitacion vigente (de cualquier dominio).
 * Lo ultimo solo se puede saber despues de autenticar, asi que el enlace se
 * envia a cualquier correo valido y la decision se toma al armar el perfil
 * (repos/usuarios.ts, asegurarPerfil): sin permiso, se cierra la sesion de
 * inmediato con un mensaje claro. Las reglas de firestore.rules validan lo
 * mismo del lado del servidor.
 */
import {
  GoogleAuthProvider,
  OAuthProvider,
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
  esEmailValido,
  mensajeAccesoDenegado,
  normalizarEmail,
  rolInicial,
  type PoliticaAcceso,
} from '@/domain/permisos/dominio'
import type { Rol } from '@/domain/tipos/comunes'

const CLAVE_CORREO = 'pmo3000.correoPendiente'

export type MetodoIngreso = 'enlace_correo' | 'google' | 'microsoft' | 'password_dev'

export const POLITICA: PoliticaAcceso = {
  dominio: AJUSTES.dominioPermitido,
  correosAdmin: AJUSTES.correosAdmin,
}

/** Lo único del entorno que necesita la interfaz. */
export const AJUSTES_AUTENTICACION = {
  usarEmuladores: AJUSTES.usarEmuladores,
  dominioPermitido: AJUSTES.dominioPermitido,
  correosAdmin: AJUSTES.correosAdmin,
  conMicrosoft: AJUSTES.tenantMicrosoft !== '',
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

function validarFormato(correo: string): void {
  if (!esEmailValido(correo)) throw new Error('Ese correo no parece válido')
}

const AJUSTES_ENLACE = () => ({
  url: `${window.location.origin}/login`,
  handleCodeInApp: true,
})

export async function enviarEnlaceIngreso(email: string): Promise<void> {
  const correo = normalizarEmail(email)
  // Solo el formato: si el correo es de otro dominio, que tenga invitacion se
  // sabe despues de entrar. Recibir un enlace no da acceso a nada.
  validarFormato(correo)

  await sendSignInLinkToEmail(auth, correo, AJUSTES_ENLACE())

  try {
    window.localStorage.setItem(CLAVE_CORREO, correo)
  } catch {
    // Modo privado sin localStorage: se le pedirá el correo de nuevo al volver.
  }
}

/**
 * Enlace para una persona invitada, enviado desde la sesion de un admin. No
 * toca la sesion del admin ni guarda nada en su navegador: la persona abre el
 * enlace en su dispositivo y la pantalla de ingreso le pide confirmar el correo.
 */
export async function enviarEnlaceInvitacion(email: string): Promise<void> {
  const correo = normalizarEmail(email)
  validarFormato(correo)
  await sendSignInLinkToEmail(auth, correo, AJUSTES_ENLACE())
}

const CLAVE_DENEGADO = 'pmo3000.accesoDenegado'

/**
 * Por que se cerro la sesion recien abierta. Sobrevive al cierre de sesion
 * (que limpia el estado de la app) para que la pantalla de ingreso lo muestre.
 */
export function recordarAccesoDenegado(mensaje: string): void {
  try {
    window.sessionStorage.setItem(CLAVE_DENEGADO, mensaje)
  } catch {
    // sin almacenamiento, el ingreso solo no avanza
  }
}

/** Lee y olvida el motivo del ultimo acceso denegado. */
export function tomarAccesoDenegado(): string | null {
  try {
    const mensaje = window.sessionStorage.getItem(CLAVE_DENEGADO)
    window.sessionStorage.removeItem(CLAVE_DENEGADO)
    return mensaje
  } catch {
    return null
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
  validarFormato(correo)

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

  // Si la cuenta no es del dominio ni tiene invitacion, asegurarPerfil cierra
  // la sesion al armar el perfil (ver la cabecera de este archivo).
  const credencial = await signInWithPopup(auth, proveedor)
  return credencial.user
}

// --- Microsoft 365 -----------------------------------------------------------

/**
 * Ingreso con la cuenta de Microsoft 365 (Office) de Claro.
 *
 * Solo lectura del perfil: se pide User.Read, que entrega nombre y correo, y
 * nada mas. La app no lee correo, calendario ni archivos, y no guarda el token
 * de Microsoft. El tenant se fija aca, pero lo que garantiza que solo entren
 * cuentas de Claro es que el registro de la aplicacion en Azure sea de un solo
 * inquilino (ver docs/ingreso-microsoft.md).
 */
export async function ingresarConMicrosoft(): Promise<User> {
  if (!AJUSTES.tenantMicrosoft) throw new Error('El ingreso con Microsoft no esta configurado')
  const proveedor = new OAuthProvider('microsoft.com')
  proveedor.addScope('User.Read')
  proveedor.setCustomParameters({ tenant: AJUSTES.tenantMicrosoft, prompt: 'select_account' })
  try {
    const credencial = await signInWithPopup(auth, proveedor)
    return credencial.user
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/account-exists-with-different-credential') {
      throw new Error(
        'Tu correo ya entró antes con otro método (enlace por correo o Google). ' +
          'Entra con ese método; un administrador puede unificarlo después.',
        { cause: e },
      )
    }
    throw e
  }
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
