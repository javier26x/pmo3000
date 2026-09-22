/**
 * Referencias entre documentos, para poder borrar sin dejar huerfanos.
 *
 * Firestore no tiene claves foraneas: borrar un programa con proyectos adentro
 * funciona sin error y deja a esos proyectos apuntando a la nada. Por eso, antes
 * de eliminar cualquier catalogo (o un sitio del maestro) se cuenta quien lo usa.
 * Si alguien lo usa no se borra: se desactiva, que conserva el historial.
 *
 * Esta tabla es la unica fuente de verdad de "quien apunta a quien". Si se agrega
 * un campo que referencia a un catalogo, hay que agregarlo aqui.
 */

export const TIPOS_ELIMINABLES = [
  'celula',
  'proveedor',
  'portafolio',
  'programa',
  'proyecto',
  'sitio',
] as const
export type TipoEliminable = (typeof TIPOS_ELIMINABLES)[number]

export const COLECCIONES_REFERENTES = [
  'programas',
  'proyectos',
  'sitioProyectos',
  'usuarios',
  'tareas',
] as const
export type ColeccionReferente = (typeof COLECCIONES_REFERENTES)[number]

export interface Referencia {
  coleccion: ColeccionReferente
  campo: string
}

export const REFERENCIAS: Record<TipoEliminable, readonly Referencia[]> = {
  celula: [
    { coleccion: 'proyectos', campo: 'celulaId' },
    { coleccion: 'sitioProyectos', campo: 'celulaId' },
    { coleccion: 'usuarios', campo: 'celulaId' },
    { coleccion: 'tareas', campo: 'celulaId' },
  ],
  proveedor: [
    { coleccion: 'proyectos', campo: 'proveedorId' },
    { coleccion: 'sitioProyectos', campo: 'proveedorId' },
    { coleccion: 'usuarios', campo: 'proveedorId' },
  ],
  portafolio: [
    { coleccion: 'programas', campo: 'portafolioId' },
    { coleccion: 'proyectos', campo: 'portafolioId' },
  ],
  programa: [
    { coleccion: 'proyectos', campo: 'programaId' },
    { coleccion: 'sitioProyectos', campo: 'programaId' },
  ],
  proyecto: [
    { coleccion: 'sitioProyectos', campo: 'proyectoId' },
    { coleccion: 'tareas', campo: 'proyectoId' },
  ],
  sitio: [
    { coleccion: 'sitioProyectos', campo: 'sitioId' },
    { coleccion: 'tareas', campo: 'sitioId' },
  ],
}

/** Cuantos documentos de cada coleccion apuntan al que se quiere borrar. */
export type ConteoReferencias = Partial<Record<ColeccionReferente, number>>

export function totalReferencias(conteo: ConteoReferencias): number {
  return Object.values(conteo).reduce<number>((n, v) => n + (v ?? 0), 0)
}

const NOMBRES: Record<ColeccionReferente, [singular: string, plural: string]> = {
  programas: ['programa', 'programas'],
  proyectos: ['proyecto', 'proyectos'],
  sitioProyectos: ['sitio en seguimiento', 'sitios en seguimiento'],
  usuarios: ['usuario', 'usuarios'],
  tareas: ['tarea', 'tareas'],
}

/** "3 sitios en seguimiento y 1 usuario". Vacio si no hay referencias. */
export function describirReferencias(conteo: ConteoReferencias): string {
  const partes = COLECCIONES_REFERENTES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => {
    const n = conteo[c] ?? 0
    return `${n} ${n === 1 ? NOMBRES[c][0] : NOMBRES[c][1]}`
  })
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Suma conteos de varias consultas sobre la misma coleccion (un proveedor puede
 * aparecer en proyectos por dos campos distintos, por ejemplo).
 */
export function sumarConteos(
  partes: readonly { coleccion: ColeccionReferente; cantidad: number }[],
): ConteoReferencias {
  const total: ConteoReferencias = {}
  for (const { coleccion, cantidad } of partes) {
    if (cantidad <= 0) continue
    total[coleccion] = (total[coleccion] ?? 0) + cantidad
  }
  return total
}

/**
 * Campos del maestro de sitios que viajan copiados en cada sitioProyecto. Si se
 * editan en el maestro, hay que reescribir la copia o la tabla y el mapa quedan
 * mostrando el valor viejo.
 */
export const CAMPOS_SITIO_DESNORMALIZADOS = {
  nombre: 'sitioNombre',
  region: 'region',
  comuna: 'comuna',
  lat: 'lat',
  lon: 'lon',
} as const

type CampoSitioDesnormalizado = keyof typeof CAMPOS_SITIO_DESNORMALIZADOS

/**
 * Parche para los sitioProyectos de un sitio, o null si ninguno de los campos
 * copiados cambio (en ese caso no hace falta tocarlos).
 */
export function parcheDesnormalizado(
  anterior: Record<CampoSitioDesnormalizado, string | number>,
  nuevo: Record<CampoSitioDesnormalizado, string | number>,
): Record<string, string | number> | null {
  const campos = Object.keys(CAMPOS_SITIO_DESNORMALIZADOS) as CampoSitioDesnormalizado[]
  if (campos.every((c) => anterior[c] === nuevo[c])) return null
  const parche: Record<string, string | number> = {}
  for (const c of campos) parche[CAMPOS_SITIO_DESNORMALIZADOS[c]] = nuevo[c]
  return parche
}
