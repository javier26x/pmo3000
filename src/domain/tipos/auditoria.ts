import { z } from 'zod'

export const TIPOS_ENTIDAD = [
  'sitio',
  'sitioProyecto',
  'tarea',
  'usuario',
  'programa',
  'proyecto',
  'gateTemplate',
  'raid',
  'importacion',
] as const
export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number]

export const ACCIONES_AUDITORIA = [
  'crear',
  'actualizar',
  'eliminar',
  'cambio_gate',
  'retroceso_gate',
  'checklist',
  'importar',
  'asignar',
] as const
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number]

export const NOMBRES_ACCION: Record<AccionAuditoria, string> = {
  crear: 'Creacion',
  actualizar: 'Actualizacion',
  eliminar: 'Eliminacion',
  cambio_gate: 'Avance de etapa',
  retroceso_gate: 'Retroceso de etapa',
  checklist: 'Checklist',
  importar: 'Importacion',
  asignar: 'Asignacion',
}

/**
 * Evento de auditoria. La coleccion es append-only por reglas de Firestore:
 * ni un admin puede editar o borrar un evento.
 */
export const esquemaEventoAuditoria = z.object({
  id: z.string().min(1),
  entidadTipo: z.enum(TIPOS_ENTIDAD),
  entidadId: z.string().min(1),

  // Contexto desnormalizado para poder filtrar el log sin joins.
  sitioId: z.string().nullable(),
  proyectoId: z.string().nullable(),
  programaId: z.string().nullable(),

  accion: z.enum(ACCIONES_AUDITORIA),
  campo: z.string().nullable(),
  valorAnterior: z.string().nullable(),
  valorNuevo: z.string().nullable(),
  detalle: z.string().nullable(),

  uid: z.string().min(1),
  email: z.string(),
  nombre: z.string(),
  ts: z.date().nullable(),
  origen: z.enum(['ui', 'import', 'seed']),
})

export type EventoAuditoria = z.infer<typeof esquemaEventoAuditoria>

/** Lo que el dominio produce; el repositorio agrega id, uid, ts y origen. */
export type EventoAuditoriaNuevo = Omit<
  EventoAuditoria,
  'id' | 'uid' | 'email' | 'nombre' | 'ts' | 'origen'
>

/** Normaliza cualquier valor a texto legible para el log. */
export function aTextoAuditoria(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor instanceof Date) return valor.toISOString()
  if (Array.isArray(valor)) return valor.map((v) => aTextoAuditoria(v) ?? '—').join(', ')
  return JSON.stringify(valor)
}
