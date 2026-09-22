import { diasEntre, esFechaISO, hoyEnChile, type FechaISO } from '@/domain/fechas'

export const SEMAFOROS = ['sin_fecha', 'ok', 'por_vencer', 'atrasado'] as const
export type Semaforo = (typeof SEMAFOROS)[number]

export const NOMBRES_SEMAFORO: Record<Semaforo, string> = {
  sin_fecha: 'Sin fecha plan',
  ok: 'En plazo',
  por_vencer: 'Por vencer',
  atrasado: 'Atrasado',
}

/** Dias de antelacion con que se avisa antes del vencimiento. */
export const DIAS_POR_VENCER = 3

/**
 * Dias de atraso de un compromiso.
 * Positivo = atrasado; negativo = dias que faltan; null = sin fecha plan.
 * Si ya hay fecha real, el atraso se congela contra esa fecha (no sigue creciendo).
 */
export function diasAtraso(
  fechaPlan: FechaISO | null,
  fechaReal: FechaISO | null,
  hoy: FechaISO = hoyEnChile(),
): number | null {
  if (!fechaPlan || !esFechaISO(fechaPlan)) return null
  const referencia = fechaReal && esFechaISO(fechaReal) ? fechaReal : hoy
  return diasEntre(fechaPlan, referencia)
}

export function semaforo(
  fechaPlan: FechaISO | null,
  fechaReal: FechaISO | null,
  hoy: FechaISO = hoyEnChile(),
): Semaforo {
  const dias = diasAtraso(fechaPlan, fechaReal, hoy)
  if (dias === null) return 'sin_fecha'
  if (dias > 0) return 'atrasado'
  if (-dias <= DIAS_POR_VENCER) return 'por_vencer'
  return 'ok'
}

/** Texto corto para la tabla: "12 d atraso", "en 3 d", "a tiempo". */
export function textoAtraso(dias: number | null): string {
  if (dias === null) return '—'
  if (dias > 0) return `${dias} d atraso`
  if (dias === 0) return 'vence hoy'
  return `en ${-dias} d`
}
