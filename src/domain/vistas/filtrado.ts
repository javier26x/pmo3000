/**
 * Filtrado y orden de las vistas. Vive en el dominio porque es logica de negocio
 * (que cuenta como atrasado, como se ordena por criticidad) y porque asi se puede
 * probar sin montar un solo componente.
 *
 * Estos filtros son del CLIENTE, sobre el conjunto que Firestore ya acoto por
 * igualdad. Ver el comentario de src/data/repos/sitioProyectos.ts.
 */
import { hoyEnChile, type FechaISO } from '@/domain/fechas'
import { diasAtraso } from '@/domain/gates/atraso'
import { CERRADO, type GateActual } from '@/domain/gates/catalogo'
import type { Prioridad } from '@/domain/tipos/comunes'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { Sitio } from '@/domain/tipos/sitio'

/**
 * Filtros que viajan al servidor como igualdades. Viven en el dominio (no en el
 * repositorio) porque son una nocion de negocio: "el programa que estoy
 * mirando", no un detalle de Firestore.
 */
export interface FiltrosSeguimiento {
  programaId: string | null
  proyectoId: string | null
  proveedorId: string | null
  celulaId: string | null
}

export const FILTROS_SERVIDOR_VACIOS: FiltrosSeguimiento = {
  programaId: null,
  proyectoId: null,
  proveedorId: null,
  celulaId: null,
}

export interface FiltrosVista {
  texto: string
  region: string | null
  comuna: string | null
  prioridad: Prioridad | null
  /**
   * El gate se filtra en el cliente, no en el servidor, a propósito: el embudo
   * tiene que seguir mostrando la distribución completa mientras uno de sus
   * tramos está seleccionado. Si el recorte fuera de servidor, al elegir un gate
   * el embudo se quedaría con una sola barra y perdería justamente el contexto
   * que lo hace útil.
   */
  gateActual: GateActual | null
  soloAtrasados: boolean
  soloBloqueados: boolean
}

export const FILTROS_VISTA_VACIOS: FiltrosVista = {
  texto: '',
  region: null,
  comuna: null,
  prioridad: null,
  gateActual: null,
  soloAtrasados: false,
  soloBloqueados: false,
}

export function hayFiltrosServidor(filtros: FiltrosSeguimiento): boolean {
  return Object.values(filtros).some((v) => v !== null)
}

export function hayFiltrosActivos(filtros: FiltrosVista): boolean {
  return (
    filtros.texto.trim() !== '' ||
    filtros.region !== null ||
    filtros.comuna !== null ||
    filtros.prioridad !== null ||
    filtros.soloAtrasados ||
    filtros.soloBloqueados
  )
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Atraso del gate en curso. null si no hay compromiso cargado. */
export function atrasoDeSeguimiento(
  sp: SitioProyecto,
  hoy: FechaISO = hoyEnChile(),
): number | null {
  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
  if (!gate) return null
  return diasAtraso(gate.fechaPlan, gate.fechaReal, hoy)
}

export function estaAtrasado(sp: SitioProyecto, hoy: FechaISO = hoyEnChile()): boolean {
  const dias = atrasoDeSeguimiento(sp, hoy)
  return dias !== null && dias > 0
}

export function filtrarSeguimientos(
  lista: readonly SitioProyecto[],
  filtros: FiltrosVista,
  hoy: FechaISO = hoyEnChile(),
): SitioProyecto[] {
  const buscado = normalizar(filtros.texto.trim())

  return lista.filter((sp) => {
    if (filtros.gateActual && sp.gateActual !== filtros.gateActual) return false
    if (filtros.region && sp.region !== filtros.region) return false
    if (filtros.comuna && sp.comuna !== filtros.comuna) return false
    if (filtros.prioridad && sp.prioridad !== filtros.prioridad) return false
    if (filtros.soloBloqueados && !sp.bloqueado) return false
    if (filtros.soloAtrasados && !estaAtrasado(sp, hoy)) return false

    if (buscado !== '') {
      const heno = normalizar(`${sp.sitioId} ${sp.sitioNombre} ${sp.comuna} ${sp.region}`)
      if (!heno.includes(buscado)) return false
    }

    return true
  })
}

export function filtrarSitios(
  lista: readonly Sitio[],
  filtros: Pick<FiltrosVista, 'texto' | 'region' | 'comuna'>,
): Sitio[] {
  const buscado = normalizar(filtros.texto.trim())
  return lista.filter((s) => {
    if (filtros.region && s.region !== filtros.region) return false
    if (filtros.comuna && s.comuna !== filtros.comuna) return false
    if (buscado === '') return true
    return normalizar(
      `${s.id} ${s.nombre} ${s.comuna} ${s.region} ${s.tecnologias.join(' ')}`,
    ).includes(buscado)
  })
}

export const CAMPOS_ORDEN = [
  'sitio',
  'nombre',
  'region',
  'gate',
  'plan',
  'atraso',
  'prioridad',
] as const
export type CampoOrden = (typeof CAMPOS_ORDEN)[number]
export type DireccionOrden = 'asc' | 'desc'

const PESO_PRIORIDAD: Record<Prioridad, number> = { baja: 0, media: 1, alta: 2, critica: 3 }

/**
 * Un registro sin el dato por el que se ordena queda SIEMPRE al final, en ambas
 * direcciones: un sitio sin fecha plan no es "el mas proximo a vencer" ni "el
 * mas lejano", simplemente no tiene compromiso cargado.
 */
function faltaDato(sp: SitioProyecto, campo: CampoOrden, hoy: FechaISO): boolean {
  if (campo === 'plan') return !sp.fechaPlanGateActual
  if (campo === 'atraso') return atrasoDeSeguimiento(sp, hoy) === null
  return false
}

/** Posicion de la etapa actual dentro de la secuencia del propio sitio. */
function ordenDeSitio(sp: SitioProyecto): number {
  if (sp.gateActual === CERRADO) return Number.MAX_SAFE_INTEGER
  return sp.gates[sp.gateActual]?.orden ?? Number.MAX_SAFE_INTEGER - 1
}

function comparar(a: SitioProyecto, b: SitioProyecto, campo: CampoOrden, hoy: FechaISO): number {
  switch (campo) {
    case 'sitio':
      return a.sitioId.localeCompare(b.sitioId, 'es')
    case 'nombre':
      return a.sitioNombre.localeCompare(b.sitioNombre, 'es')
    case 'region':
      return a.region.localeCompare(b.region, 'es') || a.comuna.localeCompare(b.comuna, 'es')
    case 'gate':
      // Cada documento lleva el orden de sus propias etapas, asi que una lista
      // que mezcla programas con procesos distintos igual ordena bien.
      return ordenDeSitio(a) - ordenDeSitio(b)
    case 'plan':
      return (a.fechaPlanGateActual ?? '').localeCompare(b.fechaPlanGateActual ?? '')
    case 'atraso':
      return (atrasoDeSeguimiento(a, hoy) ?? 0) - (atrasoDeSeguimiento(b, hoy) ?? 0)
    case 'prioridad':
      return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad]
    default:
      return 0
  }
}

export function ordenarSeguimientos(
  lista: readonly SitioProyecto[],
  campo: CampoOrden,
  direccion: DireccionOrden,
  hoy: FechaISO = hoyEnChile(),
): SitioProyecto[] {
  const signo = direccion === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    const faltaA = faltaDato(a, campo, hoy)
    const faltaB = faltaDato(b, campo, hoy)
    if (faltaA !== faltaB) return faltaA ? 1 : -1
    // Desempate estable por ID: dos vistas del mismo dato se ven igual siempre.
    return comparar(a, b, campo, hoy) * signo || a.sitioId.localeCompare(b.sitioId, 'es')
  })
}

/** Valores distintos de un campo, ordenados, para poblar los selectores. */
/**
 * Valida un gate que viene de fuera (URL, vista guardada, selector).
 *
 * Ya no hay lista cerrada contra la cual validar: los codigos los define cada
 * plantilla. Un codigo que no exista simplemente no calza con ningun sitio, que
 * es el comportamiento correcto para un filtro.
 */
export function gateDesdeTexto(valor: string | null): GateActual | null {
  const limpio = valor?.trim() ?? ''
  return limpio === '' ? null : limpio
}

export function valoresDistintos<T>(lista: readonly T[], extraer: (item: T) => string): string[] {
  const conjunto = new Set<string>()
  for (const item of lista) {
    const valor = extraer(item)
    if (valor) conjunto.add(valor)
  }
  return [...conjunto].sort((a, b) => a.localeCompare(b, 'es'))
}

export interface ResumenGates {
  porGate: Record<string, number>
  total: number
  atrasados: number
  bloqueados: number
  cerrados: number
}

/** Conteos para las cabeceras del kanban y los indicadores de la tabla. */
export function resumirSeguimientos(
  lista: readonly SitioProyecto[],
  hoy: FechaISO = hoyEnChile(),
): ResumenGates {
  const porGate: Record<string, number> = {}
  let atrasados = 0
  let bloqueados = 0
  let cerrados = 0

  for (const sp of lista) {
    porGate[sp.gateActual] = (porGate[sp.gateActual] ?? 0) + 1
    if (estaAtrasado(sp, hoy)) atrasados += 1
    if (sp.bloqueado) bloqueados += 1
    if (sp.gateActual === 'CERRADO') cerrados += 1
  }

  return { porGate, total: lista.length, atrasados, bloqueados, cerrados }
}

export function agruparPorGate(lista: readonly SitioProyecto[]): Map<GateActual, SitioProyecto[]> {
  const mapa = new Map<GateActual, SitioProyecto[]>()
  for (const sp of lista) {
    const actual = mapa.get(sp.gateActual)
    if (actual) actual.push(sp)
    else mapa.set(sp.gateActual, [sp])
  }
  return mapa
}
