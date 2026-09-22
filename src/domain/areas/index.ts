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
      etapa: sp.gateActual,
      revisionId,
      texto,
      estado,
      comentario: rev?.comentario ?? '',
    })
  }
  return pendientes
}
