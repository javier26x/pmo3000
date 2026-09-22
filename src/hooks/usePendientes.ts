import { useMemo } from 'react'
import { indiceAreas, pendientesDe, responsablesDe, type Pendiente } from '@/domain/areas'
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
      .flatMap((sp) => pendientesDe(sp, plantillaPorId(sp.gateTemplateId), indice))
      .map((p) => ({ ...p, responsables: responsablesDe(p.area, p.sp.proyectoId) }))
    return { pendientes, hayAreas: true }
  }, [seguimientos, areas, plantillaPorId])
}
