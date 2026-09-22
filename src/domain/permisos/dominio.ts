/**
 * Validacion del dominio corporativo. Se aplica en el cliente (para dar un
 * mensaje claro antes de enviar el enlace) y en firestore.rules (para que sea
 * real). Cambiarla aqui sin cambiarla alla no restringe nada.
 */

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function dominioDe(email: string): string | null {
  const arroba = normalizarEmail(email).lastIndexOf('@')
  if (arroba <= 0 || arroba === email.length - 1) return null
  return normalizarEmail(email).slice(arroba + 1)
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email))
}

export function esDominioPermitido(email: string, dominioPermitido: string): boolean {
  if (!esEmailValido(email)) return false
  return dominioDe(email) === dominioPermitido.trim().toLowerCase()
}

export function mensajeDominioInvalido(dominioPermitido: string): string {
  return `Solo se permite el acceso con correos @${dominioPermitido}`
}
