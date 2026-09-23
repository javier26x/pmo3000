import { useMemo } from 'react'
import {
  indiceAreas,
  pendientesDe,
  pendientesTx,
  responsablesDe,
  type Pendiente,
} from '@/domain/areas'
import { useCatalogos } from './useCatalogos'
import { useDespliegue } from './useDespliegue'

/**
 * Todas las revisiones pendientes de los sitios vigentes cargados, con quienes
 * responden por cada una. Se recalcula solo cuando cambian los seguimientos o
 * las areas.
 */
export function usePendientes(): {
  pendientes: (Pendiente & { responsables: string[] })[]
  hayAreas: boolean
} {
  const { seguimientos } = useDespliegue()
  const { areas, plantillaPorId } = useCatalogos()

  return useMemo(() => {
    const indice = indiceAreas(areas)
    if (indice.size === 0) return { pendientes: [], hayAreas: false }
    const pendientes = seguimientos
      .filter((sp) => sp.vigente !== false)
      .flatMap((sp) => {
        const plantilla = plantillaPorId(sp.gateTemplateId)
        return [...pendientesDe(sp, plantilla, indice), ...pendientesTx(sp, plantilla, indice)]
      })
      .map((p) => ({ ...p, responsables: responsablesDe(p.area, p.sp.proyectoId) }))
    return { pendientes, hayAreas: true }
  }, [seguimientos, areas, plantillaPorId])
}
