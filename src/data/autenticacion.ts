/**
 * Autenticacion.
 *
 * Fase 1: enlace por correo (passwordless), restringido a @claro.cl. El metodo
 * esta detras de `iniciarSesion(metodo, ...)` justamente para que agregar
 * Microsoft (Entra ID) en Fase 3 sea un caso mas y no una reescritura.
 */
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  type User,
} from 'firebase/auth'
import { AJUSTES, auth } from './firebase'
import {
  esDominioPermitido,
  mensajeDominioInvalido,
  normalizarEmail,
} from '@/domain/permisos/dominio'

const CLAVE_CORREO = 'pmo3000.correoPendiente'

export type MetodoIngreso = 'enlace_correo' | 'password_dev'

export function dominioPermitido(): string {
  return AJUSTES.dominioPermitido
}

/**
 * Lo unico del entorno que la UI necesita saber. Se expone desde aqui para que
 * ninguna pantalla tenga que importar la configuracion de Firebase.
 */
export const AJUSTES_AUTENTICACION = {
  usarEmuladores: AJUSTES.usarEmuladores,
  dominioPermitido: AJUSTES.dominioPermitido,
} as const

export function validarCorreoCorporativo(email: string): void {
  if (!esDominioPermitido(email, AJUSTES.dominioPermitido)) {
    throw new Error(mensajeDominioInvalido(AJUSTES.dominioPermitido))
  }
}

export function observarSesion(cb: (usuario: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}

/** Envia el enlace de ingreso. El correo queda guardado para completar el flujo. */
export async function enviarEnlaceIngreso(email: string): Promise<void> {
  const correo = normalizarEmail(email)
  validarCorreoCorporativo(correo)

  await sendSignInLinkToEmail(auth, correo, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  })

  try {
    window.localStorage.setItem(CLAVE_CORREO, correo)
  } catch {
    // Modo privado sin localStorage: se le pedira el correo de nuevo al volver.
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

/** Completa el ingreso cuando el usuario vuelve desde el enlace del correo. */
export async function completarIngresoConEnlace(emailProporcionado?: string): Promise<User> {
  const correo = normalizarEmail(emailProporcionado ?? correoPendiente() ?? '')
  if (!correo) {
    throw new Error('Necesitamos tu correo para completar el ingreso desde este dispositivo')
  }
  validarCorreoCorporativo(correo)

  const credencial = await signInWithEmailLink(auth, correo, window.location.href)
  try {
    window.localStorage.removeItem(CLAVE_CORREO)
  } catch {
    // sin localStorage no hay nada que limpiar
  }
  return credencial.user
}

/**
 * Atajo de desarrollo: ingresa con correo y contrasena contra el emulador.
 * Existe para no pasar por la bandeja de correo en cada prueba y se rechaza
 * cuando la app no esta apuntando a los emuladores.
 */
export async function ingresarComoUsuarioDemo(email: string, password: string): Promise<User> {
  if (!AJUSTES.usarEmuladores) {
    throw new Error('El ingreso directo solo existe con los emuladores')
  }
  validarCorreoCorporativo(email)
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
