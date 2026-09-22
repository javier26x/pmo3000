/**
 * Puntuación de coincidencias para la paleta de comandos.
 *
 * Reglas, en orden de importancia: lo que empieza igual manda, después lo que
 * empieza igual en alguna palabra, y al final lo que solo contiene el texto. Sin
 * esto, escribir "RM" en 4.500 sitios devuelve resultados en orden arbitrario y
 * la paleta deja de servir para lo único que importa: llegar rápido.
 */

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Devuelve la puntuación (mayor es mejor) o null si no hay coincidencia. */
export function puntuar(candidato: string, consulta: string): number | null {
  const c = normalizar(candidato)
  const q = normalizar(consulta)
  if (q === '') return 0
  if (c === q) return 1000

  const indice = c.indexOf(q)
  if (indice === -1) return null

  let puntos = 100 - Math.min(indice, 60)

  // Prefijo exacto: es lo que la persona estaba tecleando.
  if (indice === 0) puntos += 400
  // Inicio de palabra: "azul" en "Cerro Azul 12".
  else if (/[\s\-_/]/.test(c[indice - 1] ?? '')) puntos += 200

  // Entre dos coincidencias igual de buenas, gana la cadena más corta.
  puntos += Math.max(0, 40 - c.length / 4)

  return puntos
}

export interface Puntuado<T> {
  item: T
  puntos: number
}

/** Ordena por puntuación descendente y corta. Estable ante empates. */
export function ordenarPorCoincidencia<T>(
  items: readonly T[],
  consulta: string,
  textoDe: (item: T) => string[],
  tope: number,
): T[] {
  if (normalizar(consulta) === '') return items.slice(0, tope)

  const puntuados: Puntuado<T>[] = []
  for (const item of items) {
    let mejor: number | null = null
    for (const texto of textoDe(item)) {
      const p = puntuar(texto, consulta)
      if (p !== null && (mejor === null || p > mejor)) mejor = p
    }
    if (mejor !== null) puntuados.push({ item, puntos: mejor })
    // Corte temprano: con miles de sitios no vale la pena puntuarlos todos.
    if (puntuados.length > tope * 12) break
  }

  return puntuados
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, tope)
    .map((p) => p.item)
}
