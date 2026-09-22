import { z } from 'zod'
import { ROLES } from './comunes'
import { esquemaSellos } from './base'

/**
 * Tope de entradas del alcance, sumando las tres listas.
 *
 * No es arbitrario: la consulta acotada es un or() de hasta tres where-in, y
 * Firestore admite como maximo 30 disyunciones por consulta (y 30 valores por
 * `in`). Mas entradas harian que la consulta del usuario fallara entera.
 */
export const MAX_ENTRADAS_ALCANCE = 30

export const esquemaAlcance = z
  .object({
    celulas: z.array(z.string().min(1)),
    programas: z.array(z.string().min(1)),
    proyectos: z.array(z.string().min(1)),
  })
  .refine(
    (a) => a.celulas.length + a.programas.length + a.proyectos.length <= MAX_ENTRADAS_ALCANCE,
    { message: `El alcance admite como máximo ${MAX_ENTRADAS_ALCANCE} entradas en total` },
  )

export const esquemaUsuario = z
  .object({
    id: z.string().min(1),
    email: z.email().toLowerCase(),
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    rol: z.enum(ROLES),
    celulaId: z.string().nullable(),
    proveedorId: z.string().nullable(),
    alcance: esquemaAlcance,
    activo: z.boolean(),
    ultimoAcceso: z.date().nullable(),
  })
  .extend(esquemaSellos.shape)

export type Usuario = z.infer<typeof esquemaUsuario>

/**
 * Un contratista SIEMPRE tiene proveedor: sin el, las reglas de Firestore no
 * pueden acotar lo que ve y quedaria mirando el despliegue completo.
 */
export const esquemaUsuarioEditable = esquemaUsuario
  .pick({
    nombre: true,
    rol: true,
    celulaId: true,
    proveedorId: true,
    alcance: true,
    activo: true,
  })
  .refine((u) => u.rol !== 'contratista' || !!u.proveedorId, {
    message: 'Un contratista debe tener un proveedor asignado',
    path: ['proveedorId'],
  })

export type UsuarioEditable = z.infer<typeof esquemaUsuarioEditable>
