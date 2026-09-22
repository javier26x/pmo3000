/**
 * Catalogo de gates del despliegue. El ORDEN es la regla de negocio central:
 * un sitio no salta gates. Los codigos son estables porque se usan como claves
 * en Firestore; los nombres visibles pueden cambiar sin migrar datos.
 */

export const CODIGOS_GATE = ['TSSR', 'FC', 'RFI', 'IMP', 'D1', 'D7', 'SSV'] as const
export type CodigoGate = (typeof CODIGOS_GATE)[number]

/** Estado terminal: el sitio completo el ultimo gate y salio del flujo. */
export const CERRADO = 'CERRADO'
export type GateActual = CodigoGate | typeof CERRADO

export const NOMBRES_GATE: Record<CodigoGate, string> = {
  TSSR: 'TSSR',
  FC: 'FC',
  RFI: 'RFI',
  IMP: 'Implementacion',
  D1: 'D+1',
  D7: 'D+7',
  SSV: 'SSV',
}

export const DESCRIPCIONES_GATE: Record<CodigoGate, string> = {
  TSSR: 'Technical Site Survey Report: levantamiento tecnico del sitio aprobado.',
  FC: 'Fin de construccion: obra civil y energia terminadas.',
  RFI: 'Ready For Installation: sitio disponible para instalar equipamiento.',
  IMP: 'Implementacion: instalacion e integracion del equipamiento.',
  D1: 'Verificacion a un dia de la puesta en servicio.',
  D7: 'Verificacion a siete dias de la puesta en servicio.',
  SSV: 'Single Site Verification: aceptacion final del sitio.',
}

export function esCodigoGate(valor: unknown): valor is CodigoGate {
  return typeof valor === 'string' && (CODIGOS_GATE as readonly string[]).includes(valor)
}

export function esGateActual(valor: unknown): valor is GateActual {
  return valor === CERRADO || esCodigoGate(valor)
}

export function nombreGate(gate: GateActual): string {
  return gate === CERRADO ? 'Cerrado' : NOMBRES_GATE[gate]
}

/** Posicion del gate en la secuencia; CERRADO va al final. */
export function ordenGate(gate: GateActual): number {
  return gate === CERRADO ? CODIGOS_GATE.length : CODIGOS_GATE.indexOf(gate)
}

/** El gate que sigue en la secuencia. Despues de SSV viene CERRADO. */
export function siguienteGate(gate: GateActual): GateActual | null {
  if (gate === CERRADO) return null
  const i = CODIGOS_GATE.indexOf(gate)
  const proximo = CODIGOS_GATE[i + 1]
  return proximo ?? CERRADO
}

export function gateAnterior(gate: GateActual): GateActual | null {
  if (gate === CERRADO) return CODIGOS_GATE[CODIGOS_GATE.length - 1] ?? null
  const i = CODIGOS_GATE.indexOf(gate)
  return i <= 0 ? null : (CODIGOS_GATE[i - 1] ?? null)
}

/** Gates ya superados por un sitio que esta en `gate`. */
export function gatesCompletados(gate: GateActual): CodigoGate[] {
  return CODIGOS_GATE.slice(0, ordenGate(gate))
}
