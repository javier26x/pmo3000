/**
 * Pendientes por area: que revision espera a quien.
 *
 * Una etapa como Ingenieria la revisan varias areas (OOCC, ECE, RF,
 * Implementacion, MMOO) y cada una deja su estado en el tracker. Un sitio en
 * Ingenieria tiene pendiente a cada area que todavia no la aprueba, y ese
 * pendiente es de las personas que responden por esa area en SU proyecto.
 *
 * El tracker sigue siendo la fuente: aca solo se lee lo que trae.
 */
import {
  normalizarTexto,
  clasificarEstado,
  estaCerrado,
  type EstadoSemantico,
} from '@/domain/tracker/estados'
import { CERRADO } from '@/domain/gates/catalogo'
import type { Area } from '@/domain/tipos/area'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { hitoDeEtapa } from '@/domain/tracker/estadoSitio'

const clave = (texto: string) => normalizarTexto(texto).replace(/[^a-z0-9]/g, '')

/** Indice de nombres (id, nombre y alias, sin tildes ni signos) -> area. */
export function indiceAreas(areas: readonly Area[]): Map<string, Area> {
  const indice = new Map<string, Area>()
  for (const area of areas) {
    if (!area.activa) continue
    for (const nombre of [area.id, area.nombre, ...area.alias]) {
      const k = clave(nombre)
      if (k !== '' && !indice.has(k)) indice.set(k, area)
    }
  }
  return indice
}

/** El area de una revision importada ("rf", "Implementación"), o null. */
export function areaDeRevision(
  indice: ReadonlyMap<string, Area>,
  revision: { id: string; nombre?: string },
): Area | null {
  return indice.get(clave(revision.nombre ?? '')) ?? indice.get(clave(revision.id)) ?? null
}

/** Quienes responden por un area en un proyecto: la excepcion manda. */
export function responsablesDe(area: Area, proyectoId: string): string[] {
  const propios = area.porProyecto[proyectoId]
  return propios && propios.length > 0 ? propios : area.responsables
}

export interface Pendiente {
  sp: SitioProyecto
  area: Area
  /**
   * revision: un area que revisa la etapa actual (TSS, Ingenieria, As Built).
   * tx: la transmision o la IPRAN de un sitio ya construido, que es trabajo de
   * los equipos de Tx de la PMO y no una revision.
   */
  clase: 'revision' | 'tx'
  /** Etapa que espera la revision (la actual del sitio). */
  etapa: string
  revisionId: string
  /** Lo que dice el tracker, tal cual ("Ing Observada"), o '' si no dice nada. */
  texto: string
  estado: EstadoSemantico
  comentario: string
}

/**
 * Las revisiones de la etapa actual que su area aun no cierra. Una revision
 * aprobada o que no aplica no es pendiente; una observada, rechazada o sin
 * dato si.
 */
export function pendientesDe(
  sp: SitioProyecto,
  plantilla: GateTemplate | null,
  indice: ReadonlyMap<string, Area>,
): Pendiente[] {
  if (sp.gateActual === CERRADO) return []
  const gate = sp.gates[sp.gateActual]
  if (!gate) return []
  const definicion = plantilla?.gates.find((g) => g.codigo === sp.gateActual)
  // Las de la plantilla y las que el documento traiga aunque la plantilla ya
  // no las tenga: un dato importado no se esconde.
  const revisiones = new Map<string, string>()
  for (const r of definicion?.revisiones ?? []) revisiones.set(r.id, r.nombre)
  for (const id of Object.keys(gate.revisiones)) if (!revisiones.has(id)) revisiones.set(id, id)

  const pendientes: Pendiente[] = []
  for (const [revisionId, nombre] of revisiones) {
    const area = areaDeRevision(indice, { id: revisionId, nombre })
    if (area === null) continue
    const rev = gate.revisiones[revisionId]
    const texto = rev?.estado ?? ''
    const estado = clasificarEstado(texto, plantilla?.homologacion ?? {})
    if (estaCerrado(estado)) continue
    pendientes.push({
      sp,
      area,
      clase: 'revision',
      etapa: sp.gateActual,
      revisionId,
      texto,
      estado,
      comentario: rev?.comentario ?? '',
    })
  }
  return pendientes
}

// --------------------------------------------------------------- transmision

/** Valor importado cuyo campo empieza con `prefijo` ("tipo-tx", "status-ipran"). */
function valorQueEmpieza(sp: SitioProyecto, prefijo: string): string {
  const entrada = Object.entries(sp.valores ?? {}).find(
    ([id]) => id === prefijo || id.startsWith(`${prefijo}-`),
  )
  const valor = entrada?.[1]
  return valor === null || valor === undefined ? '' : String(valor).trim()
}

/**
 * La obra esta lista: la construccion, o algo que va despues de ella (As Built,
 * On Air), quedo completado. Recien ahi la Tx y la IPRAN pasan a ser pendientes:
 * antes, que falten es lo normal y no le toca a nadie todavia.
 */
export function construccionLista(sp: SitioProyecto): boolean {
  if (sp.gateActual === CERRADO) return true
  return Object.values(sp.gates).some((g) => {
    if (!g || g.estado !== 'completado') return false
    const hito = hitoDeEtapa(g.nombre ?? '')
    return hito === 'construccion' || hito === 'as_built' || hito === 'on_air'
  })
}

/**
 * Desde cuando la obra esta lista: la fecha real de la construccion o, si el
 * tracker no la trae, la mas temprana de lo que vino despues. Es desde cuando
 * espera la Tx.
 */
export function fechaConstruccionLista(sp: SitioProyecto): string | null {
  let construccion: string | null = null
  let despues: string | null = null
  for (const g of Object.values(sp.gates)) {
    if (!g || g.estado !== 'completado' || !g.fechaReal) continue
    const hito = hitoDeEtapa(g.nombre ?? '')
    if (hito === 'construccion') construccion = g.fechaReal
    else if (
      (hito === 'as_built' || hito === 'on_air') &&
      (despues === null || g.fechaReal < despues)
    )
      despues = g.fechaReal
  }
  return construccion ?? despues
}

/** La etapa del sitio que corresponde a un hito de transmision, con su codigo. */
function gateDeHito(sp: SitioProyecto, hito: 'tx' | 'ipran') {
  for (const [codigo, g] of Object.entries(sp.gates)) {
    if (g && hitoDeEtapa(g.nombre ?? codigo) === hito) return { codigo, gate: g }
  }
  return null
}

/**
 * La Tx y la IPRAN que faltan en un sitio construido, cada una con el area
 * que responde por ella.
 *
 * La Tx es de FO o de MMOO segun el "Tipo Tx": se busca el area por nombre o
 * alias con cada palabra del tipo ("FO/On Net" -> FO). Un tipo que no calza con
 * ninguna area (TBD, vacio, o Satelital si nadie creo esa area) no se asigna:
 * se ve en la ficha del sitio, pero no cae en la bandeja de nadie. La IPRAN es
 * del area IPRAN. Una celda vacia es falta de dato y cuenta como pendiente.
 */
export function pendientesTx(
  sp: SitioProyecto,
  plantilla: GateTemplate | null,
  indice: ReadonlyMap<string, Area>,
): Pendiente[] {
  if (sp.vigente === false || !construccionLista(sp)) return []
  const homologacion = plantilla?.homologacion ?? {}
  const pendientes: Pendiente[] = []

  const tx = gateDeHito(sp, 'tx')
  if (tx !== null && tx.gate.estado !== 'completado') {
    const tipo = valorQueEmpieza(sp, 'tipo-tx')
    const area =
      tipo
        .split(/[^A-Za-zÁÉÍÓÚáéíóúñÑ0-9]+/)
        .map((palabra) => indice.get(clave(palabra)))
        .find((a) => a !== undefined) ?? null
    if (area !== null) {
      const texto = valorQueEmpieza(sp, 'status-tx')
      pendientes.push({
        sp,
        area,
        clase: 'tx',
        etapa: tx.codigo,
        revisionId: 'tx',
        texto,
        estado: clasificarEstado(texto, homologacion),
        comentario: `Tx ${tipo}`,
      })
    }
  }

  const ipran = gateDeHito(sp, 'ipran')
  const areaIpran = indice.get('ipran') ?? null
  if (ipran !== null && ipran.gate.estado !== 'completado' && areaIpran !== null) {
    const texto = valorQueEmpieza(sp, 'status-ipran')
    const proveedor = valorQueEmpieza(sp, 'proveedor-uan') || valorQueEmpieza(sp, 'proveedor-ipran')
    pendientes.push({
      sp,
      area: areaIpran,
      clase: 'tx',
      etapa: ipran.codigo,
      revisionId: 'ipran',
      texto,
      estado: clasificarEstado(texto, homologacion),
      comentario: proveedor ? `IPRAN ${proveedor}` : 'IPRAN',
    })
  }
  return pendientes
}
