import { useMemo } from 'react'
import { medirSla, type ConfigSla, type MedicionSla } from '@/domain/sla'
import type { FechaISO } from '@/domain/fechas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useCatalogos } from './useCatalogos'

export type MedidorSla = (sp: SitioProyecto, hoy: FechaISO) => MedicionSla

/**
 * Mide el SLA de un seguimiento con la configuracion de SU proyecto. La
 * funcion es estable mientras no cambie la configuracion de ningun proyecto.
 */
export function useMedidorSla(): MedidorSla {
  const { proyectos } = useCatalogos()
  return useMemo(() => {
    const porProyecto = new Map<string, ConfigSla | null>(proyectos.map((p) => [p.id, p.sla]))
    return (sp, hoy) => medirSla(sp, porProyecto.get(sp.proyectoId), hoy)
  }, [proyectos])
}
