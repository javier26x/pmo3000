/** Concatena clases ignorando falsy. Evita traer una dependencia por esto. */
export function cn(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

/** Iniciales para el avatar: "Ana Demo" -> "AD". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  return partes.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}
