/**
 * La foto de un proyecto para su ficha: cuantos sitios tiene, donde estan
 * parados y cuantos se pasaron del SLA. Sale de los seguimientos que ya estan
 * en memoria (useDespliegue), sin consultas nuevas.
 */
import type { EstadoSla } from '@/domain/sla'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

export interface ResumenProyecto {
  total: number
  vigentes: number
  noVigentes: number
  bloqueados: number
  cerrados: number
  /** Vigentes cuya etapa actual paso su plazo. */
  fueraDeSla: number
  porVencer: number
  /** Vigentes y abiertos por etapa actual, en el orden en que aparecen las etapas. */
  porEtapa: { codigo: string; total: number }[]
  /** Plantillas de gates con que se importaron sus sitios. */
  plantillas: string[]
}

const CERRADO = 'CERRADO'

export function resumirProyecto(
  seguimientos: readonly SitioProyecto[],
  proyectoId: string,
  estadoSla: (sp: SitioProyecto) => EstadoSla,
): ResumenProyecto {
  const r: ResumenProyecto = {
    total: 0,
    vigentes: 0,
    noVigentes: 0,
    bloqueados: 0,
    cerrados: 0,
    fueraDeSla: 0,
    porVencer: 0,
    porEtapa: [],
    plantillas: [],
  }
  const porEtapa = new Map<string, { total: number; orden: number }>()
  const plantillas = new Set<string>()

  for (const sp of seguimientos) {
    if (sp.proyectoId !== proyectoId) continue
    r.total++
    plantillas.add(sp.gateTemplateId)
    if (!sp.vigente) {
      r.noVigentes++
      continue
    }
    r.vigentes++
    if (sp.bloqueado) r.bloqueados++
    if (sp.gateActual === CERRADO) {
      r.cerrados++
      continue
    }
    const sla = estadoSla(sp)
    if (sla === 'vencido') r.fueraDeSla++
    else if (sla === 'por_vencer') r.porVencer++
    const e = porEtapa.get(sp.gateActual)
    if (e) e.total++
    else porEtapa.set(sp.gateActual, { total: 1, orden: sp.ordenGateActual ?? Infinity })
  }

  r.porEtapa = [...porEtapa]
    .sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0]))
    .map(([codigo, { total }]) => ({ codigo, total }))
  r.plantillas = [...plantillas]
  return r
}
