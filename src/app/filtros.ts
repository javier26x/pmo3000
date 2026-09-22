import { create } from 'zustand'
import { FILTROS_VACIOS, type FiltrosSeguimiento } from '@/data/repos/sitioProyectos'
import {
  FILTROS_VISTA_VACIOS,
  type CampoOrden,
  type DireccionOrden,
  type FiltrosVista,
} from '@/domain/vistas/filtrado'

/**
 * Filtros compartidos entre la tabla, el mapa y el kanban: pasar de una vista a
 * otra conserva el recorte que la persona ya armo.
 *
 * `servidor` son los filtros que viajan a Firestore (igualdad); `vista` son los
 * que se aplican en memoria.
 */
interface EstadoFiltros {
  servidor: FiltrosSeguimiento
  vista: FiltrosVista
  orden: { campo: CampoOrden; direccion: DireccionOrden }
  fijarServidor: (cambios: Partial<FiltrosSeguimiento>) => void
  fijarVista: (cambios: Partial<FiltrosVista>) => void
  alternarOrden: (campo: CampoOrden) => void
  limpiar: () => void
}

export const usarFiltros = create<EstadoFiltros>((set) => ({
  servidor: FILTROS_VACIOS,
  vista: FILTROS_VISTA_VACIOS,
  orden: { campo: 'atraso', direccion: 'desc' },

  fijarServidor: (cambios) => set((estado) => ({ servidor: { ...estado.servidor, ...cambios } })),

  fijarVista: (cambios) => set((estado) => ({ vista: { ...estado.vista, ...cambios } })),

  alternarOrden: (campo) =>
    set((estado) => ({
      orden:
        estado.orden.campo === campo
          ? { campo, direccion: estado.orden.direccion === 'asc' ? 'desc' : 'asc' }
          : { campo, direccion: campo === 'atraso' ? 'desc' : 'asc' },
    })),

  limpiar: () => set({ servidor: FILTROS_VACIOS, vista: FILTROS_VISTA_VACIOS }),
}))
