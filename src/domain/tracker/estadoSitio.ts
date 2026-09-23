/**
 * Estado consolidado de un sitio, deducido de sus etapas.
 *
 * El tracker Outdoor tiene una columna "Status Sitio" que alguien escribe a mano
 * ("En Etapa de Ingeniería 4G", "Recibido Con Tx OK 4G", "On Air 4G/5G") y una
 * hoja "Homologación Estados" que la deberia calcular: una tabla que mapea la
 * concatenacion EXACTA de seis columnas (Vigencia, Status TSS, Status Ing,
 * Status Asbuilt, Status IPRAN, Sitios On air) a un estado. Con el texto libre
 * de esas celdas la llave exacta calza en 12 de 1.388 sitios: cualquier "4G" de
 * mas, una mayuscula o una errata y la fila queda sin homologar.
 *
 * Aca se expresa la MISMA logica como reglas, sobre las etapas ya clasificadas:
 *
 *   no vigente                          -> no_vigente
 *   On Air cerrado                      -> on_air
 *   TSS abierto                         -> en_tss
 *   Ingenieria abierta                  -> en_ingenieria
 *   As Built abierto                    -> en_construccion
 *   IPRAN/transmision cerrada           -> recibido_tx_ok
 *   todo lo anterior cerrado            -> recibido
 *
 * El orden es el del proceso y la primera abierta manda, igual que en la tabla
 * del Excel ("TSS Observado" + "Ing Aprobada" es En Etapa de TSS). La etapa de
 * Construccion (Estado OOCC) no participa cuando hay As Built, porque la hoja de
 * homologacion no la mira: "En Construcción" es "sin As Built aprobado".
 */
import type { FilaTracker } from './aplicacion'
import { normalizarTexto, type Tecnologia } from './estados'

// --------------------------------------------------------------- condicion

export interface CondicionSitio {
  /** Sigue en el plan. Falso con Vigencia "No Vigente" o fase "Eliminado". */
  vigente: boolean
  /** La fase dice "On Hold": el sitio esta detenido por decision del proyecto. */
  bloqueado: boolean
  motivoBloqueo: string | null
  /** El texto de la fase tal cual ("Fase 2 - On Hold RF"), o null. */
  fase: string | null
}

const RE_ON_HOLD = /on\s*-?\s*hold/i
const RE_BAJA = /eliminad|sale de plan|fuera de plan/

/**
 * Vigencia y bloqueo a partir de la columna de vigencia y la de fase.
 *
 * La columna "Proyecto" del tracker mezcla dos cosas: la fase ("Fase 1", "5G",
 * "Indoor") y la condicion del sitio ("On Hold - RF", "Fase 1 - Eliminado",
 * "Sale de Plan (RF)"). La condicion se separa aca:
 *
 * - "On Hold ..." bloquea el sitio, con el motivo que traiga ("On Hold RF").
 * - "Eliminado" o "Sale de Plan" lo deja no vigente aunque la columna Vigencia
 *   diga otra cosa.
 */
export function condicionDelSitio(
  vigencia: string | null | undefined,
  fase: string | null | undefined,
): CondicionSitio {
  const v = normalizarTexto(vigencia ?? '')
  const faseCruda = (fase ?? '').trim()
  const f = normalizarTexto(faseCruda)

  let vigente = !(v.startsWith('no') || /\bno vigente\b/.test(v) || RE_BAJA.test(v))
  if (RE_BAJA.test(f)) vigente = false

  // El Plan 200 no tiene columna de fase y anota el bloqueo en la vigencia:
  // "Vigente/On Hold".
  const hold = RE_ON_HOLD.exec(faseCruda) ?? RE_ON_HOLD.exec(vigencia ?? '')
  const origenHold = RE_ON_HOLD.test(faseCruda) ? faseCruda : (vigencia ?? '')
  let motivoBloqueo: string | null = null
  if (hold !== null) {
    const resto = origenHold
      .slice(hold.index + hold[0].length)
      .replace(/^[\s\-–:()]+/, '')
      .replace(/[()]/g, '')
      .trim()
    motivoBloqueo = `On Hold${resto === '' ? '' : ` ${resto}`} (tracker)`
  }

  return {
    vigente,
    bloqueado: hold !== null,
    motivoBloqueo,
    fase: faseCruda === '' ? null : faseCruda,
  }
}

// --------------------------------------------------------------- estado

export const ESTADOS_SITIO = [
  'no_vigente',
  'en_tss',
  'en_ingenieria',
  'en_construccion',
  'recibido',
  'recibido_tx_ok',
  'on_air',
] as const
export type EstadoSitio = (typeof ESTADOS_SITIO)[number]

export const NOMBRES_ESTADO_SITIO: Record<EstadoSitio, string> = {
  no_vigente: 'No vigente',
  en_tss: 'En etapa de TSS',
  en_ingenieria: 'En etapa de Ingeniería',
  en_construccion: 'En construcción',
  recibido: 'Recibido',
  recibido_tx_ok: 'Recibido con Tx OK',
  on_air: 'On Air',
}

type Hito = 'tss' | 'ingenieria' | 'construccion' | 'as_built' | 'on_air' | 'ipran' | 'tx'

/** Que hito del proceso representa una etapa, por su nombre. */
export function hitoDeEtapa(nombre: string): Hito | null {
  const t = normalizarTexto(nombre.replace(/_/g, ' '))
  if (/\bon ?air\b/.test(t)) return 'on_air'
  if (/\bas ?-?built\b/.test(t)) return 'as_built'
  if (/\btssr?\b/.test(t)) return 'tss'
  if (/\bing(enieria)?\b/.test(t)) return 'ingenieria'
  if (/construccion|\boocc\b|obras civiles/.test(t)) return 'construccion'
  if (/\bipran\b/.test(t)) return 'ipran'
  if (/transmision|\btx\b/.test(t)) return 'tx'
  return null
}

export interface EstadoSitioDerivado {
  estado: EstadoSitio
  tecnologia: Tecnologia | null
}

/**
 * Estado consolidado del sitio segun sus etapas. Ver el comentario del archivo.
 *
 * Una etapa que el tracker no tiene no participa: un tracker sin As Built pasa
 * de Ingenieria (o Construccion) directo a recibido.
 */
export function estadoSitio(
  fila: Pick<FilaTracker, 'etapas'> & Partial<Pick<FilaTracker, 'condicion' | 'tecnologia'>>,
): EstadoSitioDerivado {
  const tecnologia = fila.tecnologia ?? null
  if (fila.condicion !== undefined && !fila.condicion.vigente) {
    return { estado: 'no_vigente', tecnologia }
  }

  const cierre = new Map<Hito, boolean>()
  for (const etapa of fila.etapas) {
    const hito = hitoDeEtapa(etapa.nombre ?? etapa.codigo)
    if (hito !== null && !cierre.has(hito)) cierre.set(hito, etapa.cerrada)
  }
  const abierta = (h: Hito) => cierre.has(h) && cierre.get(h) === false

  let estado: EstadoSitio
  if (cierre.get('on_air') === true) estado = 'on_air'
  else if (abierta('tss')) estado = 'en_tss'
  else if (abierta('ingenieria')) estado = 'en_ingenieria'
  else if (abierta('as_built')) estado = 'en_construccion'
  else if (!cierre.has('as_built') && abierta('construccion')) estado = 'en_construccion'
  else if (cierre.get('ipran') ?? cierre.get('tx') ?? false) estado = 'recibido_tx_ok'
  else estado = 'recibido'

  return { estado, tecnologia }
}

/**
 * Lee el texto de la columna consolidada del tracker ("En Etapa de Ingeniería
 * 4G/5G", "Sitio Recibido 4G/5G") como uno de los estados de arriba, sin la
 * tecnologia. null si el texto no nombra ninguno ("Sitio 4G/5G").
 */
export function estadoSitioDesdeTexto(texto: string | null | undefined): EstadoSitio | null {
  const t = normalizarTexto(texto ?? '')
  if (t === '') return null
  if (/\bno vigente\b/.test(t)) return 'no_vigente'
  if (/\bon ?air\b/.test(t)) return 'on_air'
  // "No Recibido" y "Recibido sin Tx" no son recibido ni recibido con Tx.
  const recibido = /recibid/.test(t) && !/\bno recibid/.test(t)
  if (recibido && /\btx\b/.test(t) && !/\bsin tx\b/.test(t)) return 'recibido_tx_ok'
  if (recibido) return 'recibido'
  if (/construccion/.test(t)) return 'en_construccion'
  if (/ingenieria/.test(t)) return 'en_ingenieria'
  if (/\btss/.test(t)) return 'en_tss'
  return null
}
