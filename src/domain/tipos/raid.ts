/**
 * RAID log. Los tipos y el esquema se definen desde ya (el modelo de datos cubre
 * las 3 fases) aunque la interfaz se construye en Fase 2.
 */
import { z } from 'zod'
import { esquemaSellos, zFechaISONula } from './base'

export const TIPOS_RAID = ['riesgo', 'accion', 'issue', 'decision'] as const
export type TipoRaid = (typeof TIPOS_RAID)[number]

export const NOMBRES_TIPO_RAID: Record<TipoRaid, string> = {
  riesgo: 'Riesgo',
  accion: 'Accion',
  issue: 'Issue',
  decision: 'Decision',
}

export const ESTADOS_RAID = ['abierto', 'en_gestion', 'mitigado', 'cerrado', 'escalado'] as const
export type EstadoRaid = (typeof ESTADOS_RAID)[number]

export const esquemaEscalamiento = z.object({
  nivel: z.number().int().min(1).max(4),
  aUid: z.string().nullable(),
  aNombre: z.string(),
  fecha: zFechaISONula,
  motivo: z.string(),
  porUid: z.string().nullable(),
})
export type Escalamiento = z.infer<typeof esquemaEscalamiento>

export const esquemaRaid = z
  .object({
    id: z.string().min(1),
    tipo: z.enum(TIPOS_RAID),
    titulo: z.string().min(1),
    descripcion: z.string(),
    /** 1 = menor, 5 = critico. */
    severidad: z.number().int().min(1).max(5),
    probabilidad: z.number().int().min(1).max(5),
    impacto: z.number().int().min(1).max(5),
    estado: z.enum(ESTADOS_RAID),
    duenoUid: z.string().nullable(),
    fechaCompromiso: zFechaISONula,
    fechaCierre: zFechaISONula,
    sitioId: z.string().nullable(),
    proyectoId: z.string().nullable(),
    programaId: z.string().nullable(),
    proveedorId: z.string().nullable(),
    escalamientos: z.array(esquemaEscalamiento),
  })
  .extend(esquemaSellos.shape)

export type Raid = z.infer<typeof esquemaRaid>

/** Exposicion = probabilidad x impacto. Ordena el "top riesgos" del dashboard. */
export function exposicion(raid: Pick<Raid, 'probabilidad' | 'impacto'>): number {
  return raid.probabilidad * raid.impacto
}
