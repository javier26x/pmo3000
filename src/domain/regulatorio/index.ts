/**
 * Cierre legal y regulatorio de un sitio.
 *
 * Salir al aire no termina el sitio: desde ese dia corre el expediente que
 * pide la normativa (derecho sobre el terreno, permiso y recepcion DOM,
 * decreto y recepcion de obras de SUBTEL, y en los sitios obligatorios por
 * concurso, la carpeta de recepcion de la localidad). Aca vive lo que no
 * depende de Firestore: cuando un seguimiento entra al proceso, que
 * documentos le tocan y cuanto lleva.
 *
 * No hay proceso nocturno que "dispare" nada: un sitio al aire ya esta en el
 * proceso por el solo hecho de estar al aire. El documento de `regulatorio`
 * nace la primera vez que alguien marca algo; antes, todo esta pendiente.
 */
import { normalizarTexto } from '@/domain/tracker/estados'
import type { FechaISO } from '@/domain/fechas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import {
  CARPETAS_REGULATORIAS,
  type CarpetaRegulatoria,
  type DocumentoRegulatorio,
} from './catalogo'

export * from './catalogo'

export const MODALIDADES = ['normal', 'concurso'] as const
export type Modalidad = (typeof MODALIDADES)[number]

export const NOMBRES_MODALIDAD: Record<Modalidad, string> = {
  normal: 'Sitio normal',
  concurso: 'Obligatorio por concurso',
}

export const ESTADOS_DOCUMENTO = [
  'pendiente',
  'en_tramite',
  'observado',
  'listo',
  'no_aplica',
] as const
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number]

export const NOMBRES_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En trámite',
  observado: 'Observado',
  listo: 'Listo',
  no_aplica: 'No aplica',
}

export interface EstadoItemRegulatorio {
  estado: EstadoDocumento
  /** Fecha del documento (emision, ingreso o publicacion, segun el item). */
  fecha: FechaISO | null
  /** Numero de decreto, oficio, ingreso o rol. */
  referencia: string
  obs: string
  /** Enlace al archivo en la carpeta del sitio. */
  url: string
  por: string | null
  en: Date | null
}

/** `regulatorio/{sitioProyectoId}`: el expediente de un seguimiento. */
export interface RegistroRegulatorio {
  /** Mismo id que el seguimiento. */
  id: string
  sitioId: string
  proyectoId: string
  programaId: string
  celulaId: string | null
  /** null: se usa la sugerida por el tracker (ver modalidadSugerida). */
  modalidad: Modalidad | null
  items: Record<string, EstadoItemRegulatorio>
  actualizadoEn: Date | null
  actualizadoPor: string | null
}

export const ITEM_VACIO: EstadoItemRegulatorio = {
  estado: 'pendiente',
  fecha: null,
  referencia: '',
  obs: '',
  url: '',
  por: null,
  en: null,
}

// ------------------------------------------------------------- al aire

const RE_AL_AIRE = /\bon ?air\b|\bal aire\b/

function esEtapaAlAire(codigo: string, nombre: string): boolean {
  return RE_AL_AIRE.test(normalizarTexto(codigo)) || RE_AL_AIRE.test(normalizarTexto(nombre))
}

/**
 * Dia en que el seguimiento salio al aire, o null si todavia no sale.
 *
 * Manda la etapa On Air cuando la plantilla la tiene ("Fecha Sitio On Air" del
 * tracker); si no, un seguimiento CERRADO salio al aire el dia que cerro su
 * ultima etapa. Un CERRADO sin fechas sigue contando como al aire: el dato que
 * falta es la fecha, no el hecho.
 */
export function fechaAlAire(sp: SitioProyecto): { alAire: boolean; fecha: FechaISO | null } {
  let ultima: { orden: number; fecha: FechaISO | null } | null = null
  for (const [codigo, gate] of Object.entries(sp.gates)) {
    if (!gate) continue
    if (esEtapaAlAire(codigo, gate.nombre) && gate.estado === 'completado') {
      return { alAire: true, fecha: gate.fechaReal }
    }
    if (gate.tipo !== 'paralela' && gate.estado === 'completado') {
      if (ultima === null || gate.orden > ultima.orden) {
        ultima = { orden: gate.orden, fecha: gate.fechaReal }
      }
    }
  }
  if (sp.gateActual === 'CERRADO') return { alAire: true, fecha: ultima?.fecha ?? null }
  return { alAire: false, fecha: null }
}

// ------------------------------------------------------------ modalidad

const RE_NEGATIVO = /^(no|n\/a|na|sin|-|0|false|ninguno|no aplica)$/

/**
 * Si el tracker marca el sitio como de concurso. Los trackers traen una columna
 * "Concurso 5G" (u otra con "concurso" en el nombre) que dice que localidad u
 * obligacion cubre el sitio; con cualquier valor que no sea un "no", el sitio
 * es obligatorio por concurso.
 */
export function modalidadSugerida(sp: Pick<SitioProyecto, 'valores'>): Modalidad {
  for (const [clave, valor] of Object.entries(sp.valores)) {
    if (!/concurso|localidad|obligatori|contraprestacion/.test(normalizarTexto(clave))) continue
    if (valor === true) return 'concurso'
    if (typeof valor === 'string') {
      const v = normalizarTexto(valor)
      if (v !== '' && !RE_NEGATIVO.test(v)) return 'concurso'
    }
  }
  return 'normal'
}

export function modalidadDe(
  sp: Pick<SitioProyecto, 'valores'>,
  registro: Pick<RegistroRegulatorio, 'modalidad'> | null,
): Modalidad {
  return registro?.modalidad ?? modalidadSugerida(sp)
}

// --------------------------------------------------------------- avance

export function carpetasPara(modalidad: Modalidad): CarpetaRegulatoria[] {
  return CARPETAS_REGULATORIAS.filter((c) => c.aplica === 'ambos' || c.aplica === modalidad)
    .map((c) => ({
      ...c,
      documentos: c.documentos.filter((d) => d.aplica === 'ambos' || d.aplica === modalidad),
    }))
    .filter((c) => c.documentos.length > 0)
}

export function estadoItem(
  registro: Pick<RegistroRegulatorio, 'items'> | null,
  id: string,
): EstadoItemRegulatorio {
  return registro?.items[id] ?? ITEM_VACIO
}

export interface AvanceRegulatorio {
  /** Documentos que cuentan: los que no se marcaron "no aplica". */
  total: number
  listos: number
  enTramite: number
  observados: number
  /** Obligatorios (no condicionales) todavia pendientes. */
  obligatoriosPendientes: number
  porcentaje: number
}

export function avanceDe(
  documentos: readonly DocumentoRegulatorio[],
  registro: Pick<RegistroRegulatorio, 'items'> | null,
): AvanceRegulatorio {
  const a: AvanceRegulatorio = {
    total: 0,
    listos: 0,
    enTramite: 0,
    observados: 0,
    obligatoriosPendientes: 0,
    porcentaje: 0,
  }
  for (const d of documentos) {
    const { estado } = estadoItem(registro, d.id)
    // Un condicional que nadie marco no cuenta en contra: puede no aplicar.
    if (estado === 'no_aplica') continue
    if (d.condicional && estado === 'pendiente') continue
    a.total += 1
    if (estado === 'listo') a.listos += 1
    else if (estado === 'en_tramite') a.enTramite += 1
    else if (estado === 'observado') a.observados += 1
    if (!d.condicional && estado !== 'listo') a.obligatoriosPendientes += 1
  }
  a.porcentaje = a.total === 0 ? 0 : Math.round((a.listos / a.total) * 100)
  return a
}

export function avanceTotal(
  modalidad: Modalidad,
  registro: Pick<RegistroRegulatorio, 'items'> | null,
): AvanceRegulatorio {
  return avanceDe(
    carpetasPara(modalidad).flatMap((c) => c.documentos),
    registro,
  )
}

/** Los obligatorios cerrados: el expediente esta completo. */
export function expedienteCompleto(avance: AvanceRegulatorio): boolean {
  return avance.obligatoriosPendientes === 0 && avance.observados === 0 && avance.enTramite === 0
}
