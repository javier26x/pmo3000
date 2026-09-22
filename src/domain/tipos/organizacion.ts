import { z } from 'zod'
import { zFechaISONula } from './base'
import { esquemaSellos } from './base'

export const esquemaCelula = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    liderUid: z.string().nullable(),
    color: z.string(),
    activa: z.boolean(),
  })
  .extend(esquemaSellos.shape)
export type Celula = z.infer<typeof esquemaCelula>

export const esquemaProveedor = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    contactoNombre: z.string(),
    contactoEmail: z.string(),
    activo: z.boolean(),
  })
  .extend(esquemaSellos.shape)
export type Proveedor = z.infer<typeof esquemaProveedor>

export const esquemaPortafolio = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    responsableUid: z.string().nullable(),
    periodo: z.string(),
    activo: z.boolean(),
  })
  .extend(esquemaSellos.shape)
export type Portafolio = z.infer<typeof esquemaPortafolio>

export const ESTADOS_PROGRAMA = ['planificado', 'en_curso', 'en_riesgo', 'cerrado'] as const
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number]

export const NOMBRES_ESTADO_PROGRAMA: Record<EstadoPrograma, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  en_riesgo: 'En riesgo',
  cerrado: 'Cerrado',
}

export const esquemaPrograma = z
  .object({
    id: z.string().min(1),
    portafolioId: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    gateTemplateId: z.string().min(1),
    fechaInicio: zFechaISONula,
    fechaFin: zFechaISONula,
    estado: z.enum(ESTADOS_PROGRAMA),
    responsableUid: z.string().nullable(),
    color: z.string(),
  })
  .extend(esquemaSellos.shape)
export type Programa = z.infer<typeof esquemaPrograma>

export const esquemaProyecto = z
  .object({
    id: z.string().min(1),
    programaId: z.string().min(1),
    portafolioId: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string(),
    celulaId: z.string().nullable(),
    proveedorId: z.string().nullable(),
    responsableUid: z.string().nullable(),
    fechaInicio: zFechaISONula,
    fechaFin: zFechaISONula,
    estado: z.enum(ESTADOS_PROGRAMA),
  })
  .extend(esquemaSellos.shape)
export type Proyecto = z.infer<typeof esquemaProyecto>
