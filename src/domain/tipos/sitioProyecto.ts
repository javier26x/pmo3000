import { z } from 'zod'
import { COLORES_GATE, TIPOS_ETAPA, type CodigoGate } from '@/domain/gates/catalogo'
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
  /**
   * Copia del tipo de la etapa en la plantilla. Una paralela (FC, contrato,
   * DOM...) no entra en la secuencia: no tiene `siguiente` y nunca es el
   * gateActual. Ausente en los documentos viejos, que se leen como secuencial.
   */
  tipo: z.enum(TIPOS_ETAPA).default('secuencial'),
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
    /**
     * Si el sitio sigue en el plan del proyecto. Un sitio eliminado o que salio
     * de plan no se borra (tiene historia), pero sale de las vistas por
     * defecto. Lo trae el tracker (columna "Vigencia", o un "Eliminado" / "Sale
     * de Plan" en la fase). Los documentos anteriores a este campo son vigentes.
     */
    vigente: z.boolean().default(true),
    prioridad: z.enum(PRIORIDADES),

    /**
     * Copia de gates[gateActual].fechaPlan. Permite consultar los atrasados con
     * where('fechaPlanGateActual','<',hoy) sin un campo calculado que envejezca:
     * en Fase 1 no hay Cloud Functions que recalculen nada de noche.
     */
    fechaPlanGateActual: zFechaISONula,

    /**
     * Las otras dos copias del gate en curso, hermanas de fechaPlanGateActual.
     *
     * Existen para que la tabla, el mapa, el kanban y el Inicio no tengan que
     * abrir el mapa `gates`: con estas tres pueden calcular el semaforo (plan
     * contra real) y ordenar por etapa, que es TODO lo que leian de ahi. El
     * mapa de gates es el 86% del peso del documento, asi que dejar de
     * depender de el es el paso previo para poder sacarlo de la consulta.
     *
     * Quien mueve el gate las mantiene: ver camposGateActual() en
     * domain/gates/maquina.ts, que es el unico lugar que las calcula.
     */
    fechaRealGateActual: zFechaISONula,
    /** Posicion del gate en curso. null si el sitio esta CERRADO. */
    ordenGateActual: z.number().int().min(0).nullable().default(null),

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
