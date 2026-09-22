import { z } from 'zod'
import { CERRADO, CODIGOS_GATE, type CodigoGate } from '@/domain/gates/catalogo'
import { ESTADOS_GATE, PRIORIDADES } from './comunes'
import { esquemaSellos, zFechaISONula } from './base'

export const esquemaItemChecklist = z.object({
  ok: z.boolean(),
  obs: z.string(),
  evidenciaUrl: z.string(),
  por: z.string().nullable(),
  en: z.date().nullable(),
})
export type ItemChecklist = z.infer<typeof esquemaItemChecklist>

export const esquemaGateSitio = z.object({
  orden: z.number().int().min(0),
  estado: z.enum(ESTADOS_GATE),
  fechaPlan: zFechaISONula,
  fechaReal: zFechaISONula,
  /** Linea base congelada. Se llena en Fase 2 (Gantt); en Fase 1 queda en null. */
  fechaBaseline: zFechaISONula,
  responsableUid: z.string().nullable(),
  proveedorId: z.string().nullable(),
  checklist: z.record(z.string(), esquemaItemChecklist),
  completadoEn: z.date().nullable(),
  completadoPor: z.string().nullable(),
})
export type GateSitio = z.infer<typeof esquemaGateSitio>

const esquemaSitioProyectoBase = z
  .object({
    /** Id compuesto `proyectoId__sitioId`: hace idempotente la re-importacion. */
    id: z.string().min(1),

    sitioId: z.string().min(1),
    proyectoId: z.string().min(1),
    programaId: z.string().min(1),
    portafolioId: z.string().min(1),
    celulaId: z.string().nullable(),
    proveedorId: z.string().nullable(),
    responsableUid: z.string().nullable(),

    // Desnormalizado desde el maestro para que la tabla y el mapa no necesiten join.
    sitioNombre: z.string(),
    region: z.string(),
    comuna: z.string(),
    lat: z.number(),
    lon: z.number(),

    gateActual: z.union([z.enum(CODIGOS_GATE), z.literal(CERRADO)]),
    estadoGate: z.enum(ESTADOS_GATE),
    bloqueado: z.boolean(),
    motivoBloqueo: z.string().nullable(),
    prioridad: z.enum(PRIORIDADES),

    /**
     * Copia de gates[gateActual].fechaPlan. Permite consultar los atrasados con
     * where('fechaPlanGateActual','<',hoy) sin un campo calculado que envejezca:
     * en Fase 1 no hay Cloud Functions que recalculen nada de noche.
     */
    fechaPlanGateActual: zFechaISONula,

    gates: z.record(z.string(), esquemaGateSitio),

    gateTemplateId: z.string().min(1),
    gateTemplateVersion: z.number().int().min(1),
  })
  .extend(esquemaSellos.shape)

export const esquemaSitioProyecto = esquemaSitioProyectoBase

/** Los gates presentes dependen de la plantilla, por eso el Record es parcial. */
export type SitioProyecto = Omit<z.infer<typeof esquemaSitioProyectoBase>, 'gates'> & {
  gates: Partial<Record<CodigoGate, GateSitio>>
}

export function idSitioProyecto(proyectoId: string, sitioId: string): string {
  return `${proyectoId}__${sitioId}`
}

export function partesIdSitioProyecto(id: string): { proyectoId: string; sitioId: string } | null {
  const i = id.indexOf('__')
  if (i <= 0 || i === id.length - 2) return null
  return { proyectoId: id.slice(0, i), sitioId: id.slice(i + 2) }
}
