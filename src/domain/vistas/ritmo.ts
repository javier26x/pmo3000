/**
 * Ritmo del despliegue: cuantas etapas se cerraron cada semana.
 *
 * Es la pregunta de la reunion semanal de la PMO ("¿vamos mas rapido o mas
 * lento que antes?") y se responde con lo que los trackers si traen: la fecha
 * real de cierre de cada etapa. Las etapas paralelas (FC, contratos) no cuentan:
 * no mueven al sitio hacia el aire.
 */
import type { FechaISO } from '@/domain/fechas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

const DIA = 86_400_000

function aMs(fecha: FechaISO): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

const aISO = (ms: number): FechaISO => new Date(ms).toISOString().slice(0, 10)

/** El lunes de la semana de esa fecha. */
export function lunesDe(fecha: FechaISO): FechaISO {
  const ms = aMs(fecha) ?? 0
  const dia = new Date(ms).getUTCDay() // 0 domingo
  return aISO(ms - ((dia + 6) % 7) * DIA)
}

export interface SemanaRitmo {
  /** Lunes de la semana. */
  inicio: FechaISO
  /** Etapas secuenciales cerradas esa semana. */
  cerradas: number
  /** Sitios que cerraron su ultima etapa esa semana (quedaron al aire). */
  alAire: number
}

/** Las ultimas `semanas` semanas, de la mas antigua a la actual. */
export function ritmoSemanal(
  lista: readonly SitioProyecto[],
  hoy: FechaISO,
  semanas = 12,
): SemanaRitmo[] {
  const actual = aMs(lunesDe(hoy)) ?? 0
  const primera = actual - (semanas - 1) * 7 * DIA
  const resultado: SemanaRitmo[] = Array.from({ length: semanas }, (_, i) => ({
    inicio: aISO(primera + i * 7 * DIA),
    cerradas: 0,
    alAire: 0,
  }))
  const indice = (fecha: FechaISO | null): number => {
    const ms = fecha === null ? null : aMs(lunesDe(fecha))
    if (ms === null || ms < primera || ms > actual) return -1
    return Math.round((ms - primera) / (7 * DIA))
  }

  for (const sp of lista) {
    if (sp.vigente === false) continue
    let ultimaFecha: FechaISO | null = null
    let ultimoOrden = -1
    for (const gate of Object.values(sp.gates)) {
      if (!gate || gate.tipo === 'paralela' || gate.estado !== 'completado') continue
      const i = indice(gate.fechaReal)
      if (i >= 0) resultado[i]!.cerradas += 1
      if (gate.orden > ultimoOrden) {
        ultimoOrden = gate.orden
        ultimaFecha = gate.fechaReal
      }
    }
    if (sp.gateActual === 'CERRADO') {
      const i = indice(ultimaFecha)
      if (i >= 0) resultado[i]!.alAire += 1
    }
  }
  return resultado
}
