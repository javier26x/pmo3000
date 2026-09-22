/**
 * Quién puede entrar.
 *
 * Dos puertas, y las dos se validan igual en el cliente (para dar un mensaje
 * claro antes de intentar) y en firestore.rules (que es donde de verdad cuenta):
 *
 * 1. Los dominios corporativos: cualquier correo @clarovtr.cl o @claro.cl.
 * 2. Una lista corta de correos externos autorizados, que además entran como
 *    administradores. Existe para resolver el arranque: alguien tiene que poder
 *    administrar la instalación antes de que exista el primer administrador, y
 *    ese alguien puede no tener cuenta corporativa.
 *
 * La lista vive en dos lugares que hay que mantener sincronizados: la variable
 * VITE_CORREOS_ADMIN (cliente) y la función correosAdministradores() de
 * firestore.rules (servidor). Cambiar solo una no autoriza a nadie: si falta en
 * las reglas, la persona entra y no puede leer nada; si falta en el cliente, la
 * interfaz la rechaza antes de intentarlo.
 */

export interface PoliticaAcceso {
  /** Dominios corporativos, sin la arroba (clarovtr.cl, claro.cl). */
  dominios: readonly string[]
  /** Correos externos autorizados, que se crean con rol admin. */
  correosAdmin: readonly string[]
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function dominioDe(email: string): string | null {
  const normalizado = normalizarEmail(email)
  const arroba = normalizado.lastIndexOf('@')
  if (arroba <= 0 || arroba === normalizado.length - 1) return null
  return normalizado.slice(arroba + 1)
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email))
}

export function esDominioPermitido(email: string, dominios: string | readonly string[]): boolean {
  if (!esEmailValido(email)) return false
  const dominio = dominioDe(email)
  const lista = typeof dominios === 'string' ? [dominios] : dominios
  // Igualdad exacta, no sufijo: "noclarovtr.cl" no es "clarovtr.cl".
  return lista.some((d) => d.trim().toLowerCase() === dominio)
}

/** "@clarovtr.cl o @claro.cl", para los mensajes. */
export function textoDominios(dominios: readonly string[]): string {
  const conArroba = dominios.map((d) => `@${d}`)
  return conArroba.length <= 1
    ? (conArroba[0] ?? '')
    : `${conArroba.slice(0, -1).join(', ')} o ${conArroba.at(-1)}`
}

/** True si el correo está en la lista de administradores externos. */
export function esAdministradorInicial(email: string, correosAdmin: readonly string[]): boolean {
  if (!esEmailValido(email)) return false
  const normalizado = normalizarEmail(email)
  return correosAdmin.some((c) => normalizarEmail(c) === normalizado)
}

/** True si el correo puede iniciar sesión, por dominio o por lista. */
export function esAccesoPermitido(email: string, politica: PoliticaAcceso): boolean {
  return (
    esDominioPermitido(email, politica.dominios) ||
    esAdministradorInicial(email, politica.correosAdmin)
  )
}

/** Rol con el que se crea el perfil en el primer ingreso. */
export function rolInicial(email: string, politica: PoliticaAcceso): 'admin' | 'lector' {
  return esAdministradorInicial(email, politica.correosAdmin) ? 'admin' : 'lector'
}

export function mensajeAccesoDenegado(politica: PoliticaAcceso): string {
  const dominios = textoDominios(politica.dominios)
  return politica.correosAdmin.length > 0
    ? `Solo se permite el acceso con correos ${dominios} o con una cuenta autorizada.`
    : `Solo se permite el acceso con correos ${dominios}`
}

/** Dominios desde una variable de entorno separada por comas, sin arroba. */
export function listaDeDominios(crudo: string): string[] {
  return crudo
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => d !== '')
}

/** Lee la lista desde una variable de entorno separada por comas. */
export function listaDeCorreos(crudo: string | undefined): string[] {
  if (!crudo) return []
  return crudo
    .split(',')
    .map(normalizarEmail)
    .filter((c) => c !== '')
}
