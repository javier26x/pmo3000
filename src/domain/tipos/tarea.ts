import { z } from 'zod'
import { ESTADOS_TAREA, PRIORIDADES } from './comunes'
import { esquemaSellos, zFechaISONula } from './base'

export const TIPOS_DEPENDENCIA = ['FS', 'SS', 'FF', 'SF'] as const
export type TipoDependencia = (typeof TIPOS_DEPENDENCIA)[number]

/** Dependencias entre tareas. Se escriben en Fase 1 (vacias) y las usa el Gantt en Fase 2. */
export const esquemaDependencia = z.object({
  tareaId: z.string().min(1),
  tipo: z.enum(TIPOS_DEPENDENCIA),
  lagDias: z.number().int(),
})
export type Dependencia = z.infer<typeof esquemaDependencia>

export const esquemaTarea = z
  .object({
    id: z.string().min(1),
    titulo: z.string().min(1, 'El titulo es obligatorio'),
    descripcion: z.string(),
    estado: z.enum(ESTADOS_TAREA),
    asignadoUid: z.string().nullable(),
    celulaId: z.string().nullable(),

    // Una tarea puede colgar de un sitio o ser trabajo de celula sin sitio.
    sitioId: z.string().nullable(),
    sitioProyectoId: z.string().nullable(),
    proyectoId: z.string().nullable(),
    programaId: z.string().nullable(),
    gateCodigo: z.string().nullable(),

    prioridad: z.enum(PRIORIDADES),
    fechaInicio: zFechaISONula,
    fechaVencimiento: zFechaISONula,
    estimacionHoras: z.number().min(0).nullable(),
    /** Orden dentro de la columna del kanban. Flotante: reordenar es un solo write. */
    orden: z.number(),
    etiquetas: z.array(z.string()),
    dependencias: z.array(esquemaDependencia),
  })
  .extend(esquemaSellos.shape)

export type Tarea = z.infer<typeof esquemaTarea>

export const esquemaTareaEditable = esquemaTarea.pick({
  titulo: true,
  descripcion: true,
  estado: true,
  asignadoUid: true,
  celulaId: true,
  prioridad: true,
  fechaInicio: true,
  fechaVencimiento: true,
  estimacionHoras: true,
  etiquetas: true,
})
export type TareaEditable = z.infer<typeof esquemaTareaEditable>

/**
 * Calcula el `orden` para insertar entre dos tarjetas. Al dejar huecos de 1000
 * se pueden hacer cientos de movimientos sin reescribir la columna completa.
 */
export function ordenEntre(anterior: number | null, siguiente: number | null): number {
  if (anterior === null && siguiente === null) return 1000
  if (anterior === null) return (siguiente as number) - 1000
  if (siguiente === null) return anterior + 1000
  return (anterior + siguiente) / 2
}
