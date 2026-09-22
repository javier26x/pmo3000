import { CERRADO, CODIGOS_GATE, type GateActual } from '@/domain/gates/catalogo'
import { SEMAFOROS, type Semaforo } from '@/domain/gates/atraso'

export type ModoColor = 'gate' | 'semaforo'

const VARIABLE_GATE: Record<GateActual, string> = {
  TSSR: '--g-tssr-punto',
  FC: '--g-fc-punto',
  RFI: '--g-rfi-punto',
  IMP: '--g-imp-punto',
  D1: '--g-d1-punto',
  D7: '--g-d7-punto',
  SSV: '--g-ssv-punto',
  CERRADO: '--g-cerrado-punto',
}

const VARIABLE_SEMAFORO: Record<Semaforo, string> = {
  atrasado: '--error-fg',
  por_vencer: '--riesgo-fg',
  ok: '--ok-fg',
  sin_fecha: '--texto-3',
}

/**
 * Lee los colores desde los tokens CSS en vez de duplicarlos aqui: asi el mapa
 * cambia junto con el tema claro/oscuro y nunca se desalinea con las insignias.
 */
export function leerPaleta(): { gate: Record<string, string>; semaforo: Record<string, string> } {
  const estilos = getComputedStyle(document.documentElement)
  const leer = (variable: string) => estilos.getPropertyValue(variable).trim() || '#888888'

  const gate: Record<string, string> = {}
  for (const codigo of [...CODIGOS_GATE, CERRADO]) {
    gate[codigo] = leer(VARIABLE_GATE[codigo as GateActual])
  }

  const semaforo: Record<string, string> = {}
  for (const estado of SEMAFOROS) semaforo[estado] = leer(VARIABLE_SEMAFORO[estado])

  return { gate, semaforo }
}
