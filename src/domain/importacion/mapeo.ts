import { CAMPOS_IMPORTACION, CLAVES_OBLIGATORIAS, type ClaveImportacion } from './campos'

/** Mapeo columna del archivo -> campo del modelo. null = columna ignorada. */
export type Mapeo = Partial<Record<ClaveImportacion, number>>

/** minusculas, sin acentos, sin espacios ni simbolos: "ID Sitio" -> "idsitio". */
export function normalizarCabecera(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Autodetecta el mapeo: primero coincidencia exacta con un alias, despues por
 * contencion (para cabeceras como "Latitud (WGS84)"). Cada columna se usa una
 * sola vez, y gana el alias mas especifico.
 */
export function detectarMapeo(cabeceras: readonly unknown[]): Mapeo {
  const normalizadas = cabeceras.map(normalizarCabecera)
  const usadas = new Set<number>()
  const mapeo: Mapeo = {}

  for (const campo of CAMPOS_IMPORTACION) {
    const indice = normalizadas.findIndex(
      (cab, i) => !usadas.has(i) && cab !== '' && campo.alias.includes(cab),
    )
    if (indice >= 0) {
      mapeo[campo.clave] = indice
      usadas.add(indice)
    }
  }

  for (const campo of CAMPOS_IMPORTACION) {
    if (mapeo[campo.clave] !== undefined) continue
    const candidatos = [...campo.alias].sort((a, b) => b.length - a.length)
    for (const alias of candidatos) {
      if (alias.length < 3) continue
      const indice = normalizadas.findIndex(
        (cab, i) => !usadas.has(i) && cab !== '' && cab.includes(alias),
      )
      if (indice >= 0) {
        mapeo[campo.clave] = indice
        usadas.add(indice)
        break
      }
    }
  }

  return mapeo
}

export function faltantesObligatorios(mapeo: Mapeo): ClaveImportacion[] {
  return CLAVES_OBLIGATORIAS.filter((clave) => mapeo[clave] === undefined)
}

export function mapeoCompleto(mapeo: Mapeo): boolean {
  return faltantesObligatorios(mapeo).length === 0
}

/** Columnas del archivo que quedaron sin usar, para avisar al usuario. */
export function columnasIgnoradas(cabeceras: readonly unknown[], mapeo: Mapeo): string[] {
  const usadas = new Set(Object.values(mapeo))
  return cabeceras
    .map((c, i) => ({ texto: String(c ?? '').trim(), i }))
    .filter(({ texto, i }) => texto !== '' && !usadas.has(i))
    .map(({ texto }) => texto)
}
