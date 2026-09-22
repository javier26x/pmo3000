import { z } from 'zod'
import { COLORES_GATE, TIPOS_ETAPA, type CodigoGate } from '@/domain/gates/catalogo'
import { ESTADOS_SEMANTICOS } from '@/domain/tracker/estados'
import { TIPOS_CAMPO } from '@/domain/tracker/campos'
import { esquemaSellos } from './base'

/** Un entregable exigible para cerrar un gate. */
export const esquemaItemPlantilla = z.object({
  id: z.string().min(1),
  texto: z.string().min(1),
  obligatorio: z.boolean(),
  requiereEvidencia: z.boolean(),
})
export type ItemPlantilla = z.infer<typeof esquemaItemPlantilla>

/**
 * Una disciplina que revisa dentro de una etapa: RF, OOCC, ECE, Implementacion.
 *
 * Es lo que los trackers reales tienen y el modelo de Fase 1 no representaba.
 * Una etapa como Ingenieria no se aprueba de una: la revisan cinco areas, cada
 * una deja su estado, su comentario y su fecha, y la etapa cierra cuando todas
 * cerraron. Sin esto no hay forma de saber quien esta frenando el sitio.
 */
export const esquemaRevisionPlantilla = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  /** Si su rechazo frena la etapa. Una revision informativa no frena. */
  bloquea: z.boolean(),
})
export type RevisionPlantilla = z.infer<typeof esquemaRevisionPlantilla>

export const esquemaGatePlantilla = z.object({
  /** Libre: lo define la plantilla. Es la clave del gate en el documento. */
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().default(''),
  color: z.enum(COLORES_GATE).default('gris'),
  orden: z.number().int().min(0),
  /** Dias comprometidos para cerrar el gate desde que se inicia. */
  slaDias: z.number().int().min(0),
  checklist: z.array(esquemaItemPlantilla),
  revisiones: z.array(esquemaRevisionPlantilla).default([]),
  /**
   * Secuencial (un paso del proceso) o paralela (un requisito que corre al
   * lado, como el FC o el contrato). Ver TIPOS_ETAPA en gates/catalogo.ts. Por
   * defecto secuencial: las plantillas anteriores a este campo no cambian.
   */
  tipo: z.enum(TIPOS_ETAPA).default('secuencial'),
})
export type GatePlantilla = z.infer<typeof esquemaGatePlantilla>

/**
 * Una columna del tracker que no es una etapa: un atributo del sitio dentro del
 * proyecto. Se DECLARA en la plantilla en vez de codificarse, porque entre dos
 * trackers reales de la misma PMO hay mas de 130 columnas distintas.
 */
export const esquemaCampoPlantilla = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.enum(TIPOS_CAMPO),
  grupo: z.string().default('General'),
  opciones: z.array(z.string()).default([]),
  enTabla: z.boolean().default(false),
  origen: z.string().nullable().default(null),
})
export type CampoPlantilla = z.infer<typeof esquemaCampoPlantilla>

/**
 * Plantilla de un programa: sus etapas, sus campos y como leer sus estados.
 *
 * Se VERSIONA: al crear el seguimiento de un sitio la plantilla se copia (se
 * instancia), asi cambiarla despues no reescribe el historico de los sitios que
 * ya avanzaron con la version anterior.
 */
export const esquemaGateTemplate = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    version: z.number().int().min(1),
    activo: z.boolean(),
    gates: z.array(esquemaGatePlantilla).min(1),
    campos: z.array(esquemaCampoPlantilla).default([]),
    /**
     * Como se lee el texto libre de los estados de esta plantilla. Reemplaza la
     * hoja "Homologacion Estados" que los trackers traen: cuando el equipo usa
     * una palabra propia, se agrega aca y la app la entiende.
     */
    homologacion: z.record(z.string(), z.enum(ESTADOS_SEMANTICOS)).default({}),
  })
  .extend(esquemaSellos.shape)
export type GateTemplate = z.infer<typeof esquemaGateTemplate>

export function gateDePlantilla(
  plantilla: GateTemplate,
  codigo: CodigoGate,
): GatePlantilla | undefined {
  return plantilla.gates.find((g) => g.codigo === codigo)
}

/** La secuencia de la plantilla: solo las etapas secuenciales, en orden. */
export function codigosDePlantilla(plantilla: GateTemplate): CodigoGate[] {
  return [...plantilla.gates]
    .filter((g) => g.tipo !== 'paralela')
    .sort((a, b) => a.orden - b.orden)
    .map((g) => g.codigo)
}

/** Las etapas paralelas de la plantilla, en orden. No forman parte de la secuencia. */
export function codigosParalelosDePlantilla(plantilla: GateTemplate): CodigoGate[] {
  return [...plantilla.gates]
    .filter((g) => g.tipo === 'paralela')
    .sort((a, b) => a.orden - b.orden)
    .map((g) => g.codigo)
}
