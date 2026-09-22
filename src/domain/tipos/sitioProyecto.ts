import { z } from 'zod'
import { COLORES_GATE, type CodigoGate } from '@/domain/gates/catalogo'
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

/** Lo que deja una disciplina al revisar una etapa. */
export const esquemaRevisionSitio = z.object({
  /** El texto tal como lo escribio el negocio. La clasificacion se calcula. */
  estado: z.string(),
  comentario: z.string(),
  fecha: zFechaISONula,
  por: z.string().nullable(),
  en: z.date().nullable(),
})
export type RevisionSitio = z.infer<typeof esquemaRevisionSitio>

export const esquemaGateSitio = z.object({
  orden: z.number().int().min(0),
  /**
   * Nombre y color viajan con el gate, no se buscan en la plantilla. Es la misma
   * decision que sitioNombre y region: la tabla, el mapa y el kanban dibujan
   * 1.500 documentos sin tener que resolver a que plantilla pertenece cada uno.
   */
  nombre: z.string().default(''),
  color: z.enum(COLORES_GATE).default('gris'),
  /**
   * Codigo de la etapa que sigue, o null si es la ultima (despues viene
   * CERRADO). Se guarda porque las reglas de Firestore no pueden recorrer un
   * mapa: sin este enlace, "avanzar a la siguiente" solo se podria expresar
   * como "avanzar hacia adelante", y un salto de la primera etapa a la ultima
   * pasaria la validacion del servidor.
   */
  siguiente: z.string().nullable().default(null),
  estado: z.enum(ESTADOS_GATE),
  fechaPlan: zFechaISONula,
  fechaReal: zFechaISONula,
  /** Linea base congelada. Se llena en Fase 2 (Gantt); en Fase 1 queda en null. */
  fechaBaseline: zFechaISONula,
  responsableUid: z.string().nullable(),
  proveedorId: z.string().nullable(),
  checklist: z.record(z.string(), esquemaItemChecklist),
  revisiones: z.record(z.string(), esquemaRevisionSitio).default({}),
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

    /** Codigo de la plantilla, o CERRADO. No es un enum: lo define el tracker. */
    gateActual: z.string().min(1),
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

    /**
     * Valores de los campos declarados en la plantilla, por id de campo. Aca
     * vive todo lo que el tracker tiene y la app no codifica: "Concurso 5G",
     * "Responsable Gabinete", "Prioridad RF" y las otras ciento treinta.
     */
    valores: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .default({}),

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
