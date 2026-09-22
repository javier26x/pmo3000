/**
 * Calidad del archivo: lo que la importacion tuvo que interpretar.
 *
 * Un tracker de anos trae erratas, formulas que devuelven "0" sobre celdas
 * vacias y una columna consolidada que nadie mantiene al dia. Nada de eso frena
 * la importacion, pero quien importa tiene que verlo ANTES de escribir: si el
 * Excel dice "On Air" y las etapas dicen "En construcción", alguno de los dos
 * esta mal, y conviene saber cual antes de repartir el tablero.
 */
import type { FilaTracker } from './aplicacion'
import { ESTADOS_SITIO, estadoSitio, estadoSitioDesdeTexto, type EstadoSitio } from './estadoSitio'

/**
 * Por que no coinciden, en tres casos que se leen distinto:
 *
 * - vigencia: la columna Vigencia y el estado consolidado se contradicen
 *   ("No Vigente" en una, "En Etapa de Ingeniería" en la otra).
 * - trackerAtrasado: el consolidado dice una etapa ANTERIOR a la que respaldan
 *   las etapas. Es lo tipico de una columna que se dejo de actualizar: en el
 *   tracker Outdoor, los As Built aprobados desde mediados de 2025 siguen
 *   diciendo "En Construcción".
 * - trackerAdelantado: el consolidado dice una etapa POSTERIOR a la que
 *   respaldan las etapas. Aca falta registrar algo en las etapas.
 */
export type TipoDiscrepancia = 'vigencia' | 'trackerAtrasado' | 'trackerAdelantado'

export function tipoDiscrepancia(tracker: EstadoSitio, derivado: EstadoSitio): TipoDiscrepancia {
  if (tracker === 'no_vigente' || derivado === 'no_vigente') return 'vigencia'
  return ESTADOS_SITIO.indexOf(tracker) < ESTADOS_SITIO.indexOf(derivado)
    ? 'trackerAtrasado'
    : 'trackerAdelantado'
}

export interface DiscrepanciaEstadoSitio {
  sitioId: string
  /** Lo que dice la columna consolidada del tracker, tal cual. */
  tracker: string
  /** Lo que se deduce de las etapas. */
  derivado: EstadoSitio
  tipo: TipoDiscrepancia
}

export interface CalidadArchivo {
  filas: number
  corregidas: number
  ceros: number
  fechas: number
  noVigentes: number
  enHold: number
  /** Sitios cuyo estado consolidado del tracker se pudo leer. */
  comparables: number
  coincidencias: number
  discrepancias: number
  porTipo: Record<TipoDiscrepancia, number>
  /** Algunas discrepancias, para mostrar. */
  ejemplos: DiscrepanciaEstadoSitio[]
  /** Discrepancias agrupadas por "tracker -> derivado", de mas a menos. */
  patrones: { tracker: EstadoSitio; derivado: EstadoSitio; cantidad: number }[]
}

export function resumirCalidad(
  filas: readonly FilaTracker[],
  opciones: { maximoEjemplos?: number } = {},
): CalidadArchivo {
  const maximo = opciones.maximoEjemplos ?? 6
  const resumen: CalidadArchivo = {
    filas: 0,
    corregidas: 0,
    ceros: 0,
    fechas: 0,
    noVigentes: 0,
    enHold: 0,
    comparables: 0,
    coincidencias: 0,
    discrepancias: 0,
    porTipo: { vigencia: 0, trackerAtrasado: 0, trackerAdelantado: 0 },
    ejemplos: [],
    patrones: [],
  }
  const patrones = new Map<
    string,
    { tracker: EstadoSitio; derivado: EstadoSitio; cantidad: number }
  >()

  for (const fila of filas) {
    if (fila.sitio.id === '') continue
    resumen.filas++
    resumen.corregidas += fila.calidad?.corregidas ?? 0
    resumen.ceros += fila.calidad?.ceros ?? 0
    resumen.fechas += fila.calidad?.fechas ?? 0
    if (fila.condicion?.vigente === false) resumen.noVigentes++
    if (fila.condicion?.bloqueado === true) resumen.enHold++

    const texto = fila.estadoSitioTracker ?? null
    const tracker = estadoSitioDesdeTexto(texto)
    if (tracker === null || texto === null) continue
    resumen.comparables++
    const derivado = estadoSitio(fila).estado
    if (derivado === tracker) {
      resumen.coincidencias++
      continue
    }
    resumen.discrepancias++
    const tipo = tipoDiscrepancia(tracker, derivado)
    resumen.porTipo[tipo]++
    // Ejemplos repartidos entre los tres tipos: si no, los primeros seis suelen
    // ser todos del mismo y esconden los otros.
    const porCupo = Math.ceil(maximo / 3)
    if (
      resumen.ejemplos.length < maximo &&
      resumen.ejemplos.filter((e) => e.tipo === tipo).length < porCupo
    ) {
      resumen.ejemplos.push({ sitioId: fila.sitio.id, tracker: texto, derivado, tipo })
    }
    const clave = `${tracker}>${derivado}`
    const previo = patrones.get(clave)
    if (previo) previo.cantidad++
    else patrones.set(clave, { tracker, derivado, cantidad: 1 })
  }

  resumen.patrones = [...patrones.values()].sort((a, b) => b.cantidad - a.cantidad)
  return resumen
}
