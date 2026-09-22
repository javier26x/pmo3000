import {
  FileSpreadsheet,
  ClipboardList,
  History,
  LayoutGrid,
  Map as MapaIcono,
  SlidersHorizontal,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Accion, Recurso } from '@/domain/permisos/matriz'

export interface ItemNavegacion {
  ruta: string
  etiqueta: string
  icono: LucideIcon
  /** Permiso necesario para ver la entrada; sin el, no se muestra. */
  requiere: [Recurso, Accion]
}

export const NAVEGACION: ItemNavegacion[] = [
  { ruta: '/sitios', etiqueta: 'Sitios', icono: ClipboardList, requiere: ['sitios', 'ver'] },
  { ruta: '/mapa', etiqueta: 'Mapa', icono: MapaIcono, requiere: ['sitios', 'ver'] },
  { ruta: '/kanban', etiqueta: 'Kanban', icono: LayoutGrid, requiere: ['sitioProyectos', 'ver'] },
  { ruta: '/importar', etiqueta: 'Importar', icono: Upload, requiere: ['sitios', 'importar'] },
  {
    ruta: '/tracker',
    etiqueta: 'Tracker',
    icono: FileSpreadsheet,
    requiere: ['sitios', 'importar'],
  },
  { ruta: '/auditoria', etiqueta: 'Auditoria', icono: History, requiere: ['auditoria', 'ver'] },
  { ruta: '/usuarios', etiqueta: 'Usuarios', icono: Users, requiere: ['usuarios', 'editar'] },
  {
    ruta: '/configuracion',
    etiqueta: 'Configuración',
    icono: SlidersHorizontal,
    requiere: ['gateTemplates', 'editar'],
  },
]
