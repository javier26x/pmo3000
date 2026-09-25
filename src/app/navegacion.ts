import {
  FileSpreadsheet,
  FolderKanban,
  ClipboardList,
  History,
  House,
  Inbox,
  LayoutGrid,
  Map as MapaIcono,
  Scale,
  SlidersHorizontal,
  Timer,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Accion, Recurso } from '@/domain/permisos/matriz'

/**
 * Los grupos del panel, en orden. Separan lo que se mira a diario (el
 * seguimiento) de lo que se prepara de vez en cuando (proyectos, cargas) y de la
 * administracion: con once entradas sueltas costaba encontrar la que se buscaba.
 */
export const GRUPOS_NAVEGACION = ['Seguimiento', 'Gestión', 'Administración'] as const
export type GrupoNavegacion = (typeof GRUPOS_NAVEGACION)[number]

export interface ItemNavegacion {
  ruta: string
  grupo: GrupoNavegacion
  etiqueta: string
  icono: LucideIcon
  /** Permiso necesario para ver la entrada; sin el, no se muestra. */
  requiere: [Recurso, Accion]
}

export const NAVEGACION: ItemNavegacion[] = [
  {
    ruta: '/',
    grupo: 'Seguimiento',
    etiqueta: 'Inicio',
    icono: House,
    requiere: ['sitioProyectos', 'ver'],
  },
  {
    ruta: '/sitios',
    grupo: 'Seguimiento',
    etiqueta: 'Sitios',
    icono: ClipboardList,
    requiere: ['sitios', 'ver'],
  },
  {
    ruta: '/mapa',
    grupo: 'Seguimiento',
    etiqueta: 'Mapa',
    icono: MapaIcono,
    requiere: ['sitios', 'ver'],
  },
  {
    ruta: '/kanban',
    grupo: 'Seguimiento',
    etiqueta: 'Kanban',
    icono: LayoutGrid,
    requiere: ['sitioProyectos', 'ver'],
  },
  {
    ruta: '/pendientes',
    grupo: 'Seguimiento',
    etiqueta: 'Pendientes',
    icono: Inbox,
    requiere: ['areas', 'ver'],
  },
  {
    ruta: '/tiempos',
    grupo: 'Seguimiento',
    etiqueta: 'Tiempos',
    icono: Timer,
    requiere: ['sitioProyectos', 'ver'],
  },
  // Lo que sigue al On Air: el expediente legal y regulatorio de cada sitio.
  {
    ruta: '/regulatorio',
    grupo: 'Seguimiento',
    etiqueta: 'Regulatorio',
    icono: Scale,
    requiere: ['regulatorio', 'ver'],
  },
  {
    ruta: '/proyectos',
    grupo: 'Gestión',
    etiqueta: 'Proyectos',
    icono: FolderKanban,
    requiere: ['proyectos', 'ver'],
  },
  // Los dos importadores se llaman por lo que cargan: "Tracker" a secas no
  // decia que tambien era una importacion.
  {
    ruta: '/tracker',
    grupo: 'Gestión',
    etiqueta: 'Importar tracker',
    icono: FileSpreadsheet,
    requiere: ['sitios', 'importar'],
  },
  {
    ruta: '/importar',
    grupo: 'Gestión',
    etiqueta: 'Importar sitios',
    icono: Upload,
    requiere: ['sitios', 'importar'],
  },
  {
    ruta: '/auditoria',
    grupo: 'Administración',
    etiqueta: 'Auditoría',
    icono: History,
    requiere: ['auditoria', 'ver'],
  },
  {
    ruta: '/usuarios',
    grupo: 'Administración',
    etiqueta: 'Usuarios',
    icono: Users,
    requiere: ['usuarios', 'editar'],
  },
  {
    ruta: '/configuracion',
    grupo: 'Administración',
    etiqueta: 'Configuración',
    icono: SlidersHorizontal,
    requiere: ['proyectos', 'editar'],
  },
]
