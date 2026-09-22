/**
 * Matriz de permisos rol x recurso x accion.
 *
 * Esta matriz gobierna lo que la UI ofrece. La AUTORIDAD real son las reglas de
 * Firestore (firestore.rules), que repiten estas decisiones del lado del
 * servidor: un cliente manipulado no gana nada saltandose esta matriz.
 * Si cambias algo aqui, cambialo tambien en firestore.rules y en sus tests.
 */
import type { Rol } from '@/domain/tipos/comunes'

export const RECURSOS = [
  'sitios',
  'sitioProyectos',
  'tareas',
  'usuarios',
  'auditoria',
  'portafolios',
  'programas',
  'proyectos',
  'gateTemplates',
  'proveedores',
  'celulas',
  'areas',
  'raid',
  'config',
] as const
export type Recurso = (typeof RECURSOS)[number]

export const ACCIONES = [
  'ver',
  'crear',
  'editar',
  'eliminar',
  'importar',
  'avanzarGate',
  'retrocederGate',
  'editarChecklist',
  'registrarFechaReal',
  'comentar',
] as const
export type Accion = (typeof ACCIONES)[number]

type Permiso = `${Recurso}:${Accion}`

const TODO = '*' as const

const MATRIZ: Record<Rol, readonly (Permiso | typeof TODO)[]> = {
  admin: [TODO],

  jefe_celula: [
    'sitios:ver',
    'sitios:crear',
    'sitios:editar',
    'sitios:importar',
    'sitioProyectos:ver',
    'sitioProyectos:crear',
    'sitioProyectos:editar',
    'sitioProyectos:avanzarGate',
    'sitioProyectos:retrocederGate',
    'sitioProyectos:editarChecklist',
    'sitioProyectos:registrarFechaReal',
    'sitioProyectos:comentar',
    'tareas:ver',
    'tareas:crear',
    'tareas:editar',
    'tareas:eliminar',
    'raid:ver',
    'raid:crear',
    'raid:editar',
    'usuarios:ver',
    'auditoria:ver',
    'portafolios:ver',
    'programas:ver',
    'proyectos:ver',
    'proyectos:crear',
    'proyectos:editar',
    'gateTemplates:ver',
    'proveedores:ver',
    'celulas:ver',
    'areas:ver',
    'areas:crear',
    'areas:editar',
    'config:ver',
  ],

  analista: [
    'sitios:ver',
    'sitios:crear',
    'sitios:editar',
    'sitios:importar',
    'sitioProyectos:ver',
    'sitioProyectos:crear',
    'sitioProyectos:editar',
    'sitioProyectos:avanzarGate',
    'sitioProyectos:editarChecklist',
    'sitioProyectos:registrarFechaReal',
    'sitioProyectos:comentar',
    'tareas:ver',
    'tareas:crear',
    'tareas:editar',
    'raid:ver',
    'raid:crear',
    'raid:editar',
    'usuarios:ver',
    'auditoria:ver',
    'portafolios:ver',
    'programas:ver',
    'proyectos:ver',
    'gateTemplates:ver',
    'proveedores:ver',
    'celulas:ver',
    'areas:ver',
    'config:ver',
  ],

  // El contratista reporta avance de SUS sitios: marca entregables y fecha real,
  // pero no decide que el gate paso. Eso lo aprueba la PMO.
  contratista: [
    'sitios:ver',
    'sitioProyectos:ver',
    'sitioProyectos:editarChecklist',
    'sitioProyectos:registrarFechaReal',
    'sitioProyectos:comentar',
    'tareas:ver',
    'gateTemplates:ver',
    'proveedores:ver',
    'celulas:ver',
  ],

  lector: [
    'sitios:ver',
    'sitioProyectos:ver',
    'tareas:ver',
    'raid:ver',
    'auditoria:ver',
    'portafolios:ver',
    'programas:ver',
    'proyectos:ver',
    'gateTemplates:ver',
    'proveedores:ver',
    'celulas:ver',
    'areas:ver',
    'usuarios:ver',
    'config:ver',
  ],
}

export function puede(rol: Rol, recurso: Recurso, accion: Accion): boolean {
  const permisos = MATRIZ[rol]
  if (permisos.includes(TODO)) return true
  return permisos.includes(`${recurso}:${accion}`)
}

/**
 * Filtro obligatorio segun el rol. Firestore evalua las reglas documento por
 * documento: si el contratista consulta sin este `where`, la query COMPLETA
 * falla con permission-denied. El repositorio lo inyecta siempre.
 */
export function filtroObligatorio(actor: {
  rol: Rol
  proveedorId: string | null
}): { campo: 'proveedorId'; valor: string } | null {
  if (actor.rol !== 'contratista') return null
  if (!actor.proveedorId) {
    throw new Error('Un contratista sin proveedor asignado no puede consultar sitios')
  }
  return { campo: 'proveedorId', valor: actor.proveedorId }
}

/** True si el actor solo ve un subconjunto del despliegue. */
export function tieneVisibilidadParcial(rol: Rol): boolean {
  return rol === 'contratista'
}
