/**
 * SLA por etapa: cuantos dias puede estar un sitio en cada etapa.
 *
 * Es distinto de la desviacion contra la fecha plan (domain/gates/atraso): la
 * fecha plan es un compromiso por sitio, y en los trackers importados casi
 * nunca viene. El SLA es una regla del proyecto: "el TSS no debe tomar mas de
 * 15 dias", y se mide con lo que el tracker si trae, la fecha en que se cerro
 * la etapa anterior.
 *
 * Cada proyecto fija sus dias por etapa y, si una celula trabaja con otros
 * plazos, una excepcion para esa celula. Se cuentan dias corridos o habiles,
 * segun el proyecto.
 */
import { diasEntre, diasHabilesEntre, type FechaISO } from '@/domain/fechas'
import { CERRADO, secuenciaDeGates } from '@/domain/gates/catalogo'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

export interface ConfigSla {
  /** Etapa -> dias. Una etapa sin entrada no tiene SLA. */
  dias: Record<string, number>
  /** Celula -> etapa -> dias, cuando esa celula trabaja con otro plazo. */
  porCelula: Record<string, Record<string, number>>
  /** Dias habiles (lunes a viernes) en vez de corridos. */
  habiles: boolean
}

export const SLA_VACIO: ConfigSla = { dias: {}, porCelula: {}, habiles: false }

/** Los dias de SLA de una etapa para una celula: la excepcion manda. */
export function slaDe(
  config: ConfigSla | null | undefined,
  celulaId: string | null,
  etapa: string,
): number | null {
  if (!config) return null
  const propio = celulaId === null ? undefined : config.porCelula[celulaId]?.[etapa]
  const dias = propio ?? config.dias[etapa]
  return typeof dias === 'number' && Number.isFinite(dias) && dias > 0 ? dias : null
}

/**
 * Desde cuando esta el sitio en su etapa actual: la fecha real de cierre de la
 * etapa secuencial anterior. null en la primera etapa (el tracker no trae
 * cuando empezo) o si la anterior se cerro sin fecha.
 */
export function entradaEnEtapa(sp: SitioProyecto): FechaISO | null {
  if (sp.gateActual === CERRADO) return null
  const secuencia = secuenciaDeGates(sp.gates)
  const i = secuencia.indexOf(sp.gateActual)
  if (i <= 0) return null
  const anterior = secuencia[i - 1]
  return (anterior && sp.gates[anterior]?.fechaReal) || null
}

export type EstadoSla = 'sin_sla' | 'sin_inicio' | 'en_plazo' | 'por_vencer' | 'vencido' | 'cerrado'

export interface MedicionSla {
  estado: EstadoSla
  /** Dias de SLA de la etapa actual. */
  sla: number | null
  /** Dias que lleva en la etapa. */
  transcurridos: number | null
  /** Dias que le quedan (negativo: vencido hace tantos). */
  restantes: number | null
}

/** Queda poco: el 20% final del plazo, y al menos los ultimos 2 dias. */
function porVencer(sla: number, restantes: number): boolean {
  return restantes <= Math.max(2, Math.round(sla * 0.2))
}

export function medirSla(
  sp: SitioProyecto,
  config: ConfigSla | null | undefined,
  hoy: FechaISO,
): MedicionSla {
  if (sp.gateActual === CERRADO) {
    return { estado: 'cerrado', sla: null, transcurridos: null, restantes: null }
  }
  const sla = slaDe(config, sp.celulaId, sp.gateActual)
  if (sla === null) return { estado: 'sin_sla', sla: null, transcurridos: null, restantes: null }
  const entrada = entradaEnEtapa(sp)
  if (entrada === null) return { estado: 'sin_inicio', sla, transcurridos: null, restantes: null }

  const transcurridos = Math.max(
    0,
    config?.habiles ? diasHabilesEntre(entrada, hoy) : diasEntre(entrada, hoy),
  )
  const restantes = sla - transcurridos
  const estado: EstadoSla =
    restantes < 0 ? 'vencido' : porVencer(sla, restantes) ? 'por_vencer' : 'en_plazo'
  return { estado, sla, transcurridos, restantes }
}

/**
 * La configuracion en una linea legible, para la auditoria:
 * "TSS 15 d, INGENIERIA 20 d; cel-2: INGENIERIA 25 d; dias habiles".
 */
export function describirSla(config: ConfigSla | null | undefined): string | null {
  if (!config) return null
  const lista = (dias: Record<string, number>) =>
    Object.entries(dias)
      .map(([etapa, n]) => `${etapa} ${n} d`)
      .join(', ')
  const partes = [lista(config.dias) || 'sin plazo general']
  for (const [celula, dias] of Object.entries(config.porCelula)) {
    partes.push(`${celula}: ${lista(dias)}`)
  }
  partes.push(config.habiles ? 'días hábiles' : 'días corridos')
  return partes.join('; ')
}

/** Texto corto: "12/20 d", "5 d vencido". */
export function textoSla(m: MedicionSla): string {
  if (m.estado === 'sin_sla' || m.estado === 'cerrado') return '—'
  if (m.transcurridos === null) return `SLA ${m.sla} d`
  if (m.estado === 'vencido') return `${-(m.restantes ?? 0)} d vencido`
  return `${m.transcurridos}/${m.sla} d`
}
