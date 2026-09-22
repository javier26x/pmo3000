export const ROLES = ['admin', 'jefe_celula', 'analista', 'contratista', 'lector'] as const
export type Rol = (typeof ROLES)[number]

export const NOMBRES_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  jefe_celula: 'Jefe de celula',
  analista: 'Analista',
  contratista: 'Contratista',
  lector: 'Lector',
}

export const PRIORIDADES = ['baja', 'media', 'alta', 'critica'] as const
export type Prioridad = (typeof PRIORIDADES)[number]

export const NOMBRES_PRIORIDAD: Record<Prioridad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
}

export const ESTADOS_GATE = ['no_iniciado', 'en_curso', 'bloqueado', 'completado'] as const
export type EstadoGate = (typeof ESTADOS_GATE)[number]

export const NOMBRES_ESTADO_GATE: Record<EstadoGate, string> = {
  no_iniciado: 'No iniciado',
  en_curso: 'En curso',
  bloqueado: 'Bloqueado',
  completado: 'Completado',
}

export const ESTADOS_TAREA = ['backlog', 'en_curso', 'bloqueada', 'en_revision', 'hecha'] as const
export type EstadoTarea = (typeof ESTADOS_TAREA)[number]

export const NOMBRES_ESTADO_TAREA: Record<EstadoTarea, string> = {
  backlog: 'Backlog',
  en_curso: 'En curso',
  bloqueada: 'Bloqueada',
  en_revision: 'En revision',
  hecha: 'Hecha',
}

/** Marca que un tipo viene de Firestore con sellos de sistema ya resueltos a Date. */
export interface Sellos {
  creadoEn: Date | null
  creadoPor: string | null
  actualizadoEn: Date | null
  actualizadoPor: string | null
}

/**
 * Alcance de un usuario: que parte del despliegue puede ver y tocar.
 *
 * Un seguimiento queda dentro si su celula, su programa O su proyecto esta en
 * la lista correspondiente. Las tres listas vacias significan "sin
 * restriccion" (el comportamiento de siempre). A un admin nunca se le aplica.
 * Ver src/domain/permisos/alcance.ts y firestore.rules > enAlcance().
 */
export interface Alcance {
  celulas: string[]
  programas: string[]
  proyectos: string[]
}

/** Identidad minima de quien ejecuta una operacion de dominio. */
export interface Actor {
  uid: string
  email: string
  nombre: string
  rol: Rol
  celulaId: string | null
  proveedorId: string | null
  alcance: Alcance
}
