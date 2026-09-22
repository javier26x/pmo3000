import { z } from 'zod'
import { ROLES } from './comunes'
import { esquemaAlcance } from './usuario'

export const ESTADOS_INVITACION = ['pendiente', 'aceptada', 'revocada'] as const
export type EstadoInvitacion = (typeof ESTADOS_INVITACION)[number]

/**
 * Una persona invitada antes de su primer ingreso. El id del documento es el
 * correo en minusculas: asi las reglas la encuentran con el correo del token.
 *
 * Deja listo el perfil (rol, celula, proveedor, alcance) y, para correos de
 * otro dominio, es lo que les permite entrar: sin invitacion vigente, las
 * reglas no los dejan pasar. Revocarla les quita el acceso.
 */
export const esquemaInvitacion = z.object({
  id: z.string().min(1),
  email: z.email(),
  nombre: z.string(),
  rol: z.enum(ROLES),
  celulaId: z.string().nullable(),
  proveedorId: z.string().nullable(),
  alcance: esquemaAlcance,
  estado: z.enum(ESTADOS_INVITACION),
  invitadoPor: z.string().nullable(),
  invitadoEn: z.date().nullable(),
  aceptadaEn: z.date().nullable(),
})
export type Invitacion = z.infer<typeof esquemaInvitacion>
