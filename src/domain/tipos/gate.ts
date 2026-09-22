import { z } from 'zod'
import { CODIGOS_GATE, type CodigoGate } from '@/domain/gates/catalogo'
import { esquemaSellos } from './base'

/** Un entregable exigible para cerrar un gate. */
export const esquemaItemPlantilla = z.object({
  id: z.string().min(1),
  texto: z.string().min(1),
  obligatorio: z.boolean(),
  requiereEvidencia: z.boolean(),
})
export type ItemPlantilla = z.infer<typeof esquemaItemPlantilla>

export const esquemaGatePlantilla = z.object({
  codigo: z.enum(CODIGOS_GATE),
  nombre: z.string().min(1),
  orden: z.number().int().min(0),
  /** Dias comprometidos para cerrar el gate desde que se inicia. */
  slaDias: z.number().int().min(0),
  checklist: z.array(esquemaItemPlantilla),
})
export type GatePlantilla = z.infer<typeof esquemaGatePlantilla>

/**
 * Plantilla de gates de un programa. Se VERSIONA: al crear el seguimiento de un
 * sitio la plantilla se copia (se instancia), asi cambiarla despues no reescribe
 * el historico de los sitios que ya avanzaron con la version anterior.
 */
export const esquemaGateTemplate = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    version: z.number().int().min(1),
    activo: z.boolean(),
    gates: z.array(esquemaGatePlantilla).min(1),
  })
  .extend(esquemaSellos.shape)
export type GateTemplate = z.infer<typeof esquemaGateTemplate>

export function gateDePlantilla(
  plantilla: GateTemplate,
  codigo: CodigoGate,
): GatePlantilla | undefined {
  return plantilla.gates.find((g) => g.codigo === codigo)
}

export function codigosDePlantilla(plantilla: GateTemplate): CodigoGate[] {
  return [...plantilla.gates].sort((a, b) => a.orden - b.orden).map((g) => g.codigo)
}
