/**
 * A que plan pertenece cada fila del tracker, y cuales se importan a un proyecto.
 *
 * Un tracker trae TODO lo que la PMO sigue, vigente o no: el Outdoor mezcla
 * Fase 1, Fase 2, 5G, Indoor, Rutas y el Plan 2025-2026 en la misma hoja. Un
 * proyecto de la app es uno de esos planes, y en el Excel se define con dos
 * filtros: la columna "Proyecto" y la columna "Vigencia".
 *
 * La columna "Proyecto" mezcla el plan con la condicion del sitio: "Fase 2 - On
 * Hold RF" es el plan Fase 2 con el sitio en espera, y "On Hold - RF" o "No
 * Vigente" ya no dicen de que plan era. Aca se separan.
 */
import { normalizarTexto } from './estados'
import type { FilaTracker } from './aplicacion'

/**
 * Lo que marca el fin del nombre del plan: una condicion del sitio. "Plan
 * 2025-2026" lleva guion y no se corta; "5G - On Hold RF" si, en el "On Hold".
 */
const RE_CONDICION =
  /\b(on\s*-?\s*hold|eliminad[oa]s?|sale\s+de\s+plan|fuera\s+de\s+plan|no\s+vigente|implementad[oa])\b/i

export interface PlanDeFila {
  /** Clave para comparar: sin mayusculas, tildes, guiones ni espacios de mas. */
  clave: string
  /** Como lo escribe el tracker, para mostrarlo. */
  etiqueta: string
}

/**
 * El plan que nombra la columna "Proyecto", o null si no nombra ninguno ("On
 * Hold - RF", "No Vigente", "Sale de Plan (RF)", celda vacia).
 *
 * "Rutas - Fase 1" y "Rutas Fase 1", o "5G " y "5G", dan la misma clave: son
 * el mismo plan escrito de dos formas.
 */
export function planDeFase(fase: string | null | undefined): PlanDeFila | null {
  const crudo = (fase ?? '').trim()
  const m = RE_CONDICION.exec(crudo)
  const etiqueta = (m === null ? crudo : crudo.slice(0, m.index))
    .replace(/[\s\-–_:(]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const clave = normalizarTexto(etiqueta.replace(/[-–_:()]/g, ' '))
  if (clave === '') return null
  return { clave, etiqueta }
}

/** Que filas de un tracker son de un proyecto. Se guarda en el proyecto. */
export interface FiltroPlan {
  /** Claves de plan (planDeFase().clave). Vacio: sin filtro, entra todo. */
  planes: string[]
  /** Solo las filas con Vigencia "Vigente". */
  soloVigentes: boolean
}

export const SIN_FILTRO_PLAN: FiltroPlan = { planes: [], soloVigentes: false }

export function filtraAlgo(filtro: FiltroPlan | null | undefined): filtro is FiltroPlan {
  return filtro !== null && filtro !== undefined && filtro.planes.length > 0
}

/** La fila cumple el filtro: es de uno de los planes y, si se pide, vigente. */
export function filaEnPlan(fila: FilaTracker, filtro: FiltroPlan | null | undefined): boolean {
  if (!filtraAlgo(filtro)) return true
  const plan = planDeFase(fila.condicion?.fase)
  if (plan === null || !filtro.planes.includes(plan.clave)) return false
  return !filtro.soloVigentes || (fila.condicion?.vigente ?? true)
}

export interface ResumenPlan {
  clave: string
  /** La forma mas frecuente en que el tracker lo escribe. */
  etiqueta: string
  vigentes: number
  noVigentes: number
}

/**
 * Los planes que trae el archivo, de mas a menos filas, y cuantas filas no
 * nombran ninguno. Es lo que se ofrece para elegir.
 */
export function resumirPlanes(filas: readonly FilaTracker[]): {
  planes: ResumenPlan[]
  sinPlan: number
} {
  const porClave = new Map<string, ResumenPlan & { formas: Map<string, number> }>()
  let sinPlan = 0
  for (const fila of filas) {
    if (fila.sitio.id === '') continue
    const plan = planDeFase(fila.condicion?.fase)
    if (plan === null) {
      sinPlan++
      continue
    }
    let r = porClave.get(plan.clave)
    if (r === undefined) {
      r = { clave: plan.clave, etiqueta: plan.etiqueta, vigentes: 0, noVigentes: 0, formas: new Map() }
      porClave.set(plan.clave, r)
    }
    if (fila.condicion?.vigente ?? true) r.vigentes++
    else r.noVigentes++
    r.formas.set(plan.etiqueta, (r.formas.get(plan.etiqueta) ?? 0) + 1)
  }
  const planes = [...porClave.values()]
    .map(({ formas, ...r }) => ({
      ...r,
      etiqueta: [...formas].sort((a, b) => b[1] - a[1])[0]?.[0] ?? r.etiqueta,
    }))
    .sort((a, b) => b.vigentes + b.noVigentes - (a.vigentes + a.noVigentes))
  return { planes, sinPlan }
}
