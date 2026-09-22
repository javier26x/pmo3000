import { CERRADO, colorGate, ETAPA_CERRADO, type EtapaCatalogo } from '@/domain/gates/catalogo'
import { SEMAFOROS, type Semaforo } from '@/domain/gates/atraso'

export type ModoColor = 'gate' | 'semaforo'

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
export function leerPaleta(etapas: readonly EtapaCatalogo[] = []): {
  gate: Record<string, string>
  semaforo: Record<string, string>
} {
  const estilos = getComputedStyle(document.documentElement)
  const leer = (variable: string) => estilos.getPropertyValue(variable).trim() || '#888888'

  const gate: Record<string, string> = {}
  for (const etapa of [...etapas, ETAPA_CERRADO]) {
    gate[etapa.codigo] = leer(`--g-${colorGate(etapa.codigo, etapas)}-punto`)
  }
  gate[CERRADO] = leer(`--g-${ETAPA_CERRADO.color}-punto`)

  const semaforo: Record<string, string> = {}
  for (const estado of SEMAFOROS) semaforo[estado] = leer(VARIABLE_SEMAFORO[estado])

  return { gate, semaforo }
}
