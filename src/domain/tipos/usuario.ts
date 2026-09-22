import { z } from 'zod'
import { ROLES } from './comunes'
import { esquemaSellos } from './base'

export const esquemaUsuario = z
  .object({
    id: z.string().min(1),
    email: z.email().toLowerCase(),
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    rol: z.enum(ROLES),
    celulaId: z.string().nullable(),
    proveedorId: z.string().nullable(),
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
  .pick({ nombre: true, rol: true, celulaId: true, proveedorId: true, activo: true })
  .refine((u) => u.rol !== 'contratista' || !!u.proveedorId, {
    message: 'Un contratista debe tener un proveedor asignado',
    path: ['proveedorId'],
  })

export type UsuarioEditable = z.infer<typeof esquemaUsuarioEditable>
