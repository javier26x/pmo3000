import { z } from 'zod'
import { esFechaISO, type FechaISO } from '@/domain/fechas'

/** Dia civil 'YYYY-MM-DD'. Ver src/domain/fechas para el porque. */
export const zFechaISO = z.string().refine(esFechaISO, {
  message: 'Debe ser una fecha valida con formato AAAA-MM-DD',
}) as unknown as z.ZodType<FechaISO>

export const zFechaISONula = z.union([zFechaISO, z.null()])

/** Sellos de sistema; instantes reales, no dias civiles. */
export const esquemaSellos = z.object({
  creadoEn: z.date().nullable(),
  creadoPor: z.string().nullable(),
  actualizadoEn: z.date().nullable(),
  actualizadoPor: z.string().nullable(),
})

export const zIdFirestore = z
  .string()
  .min(1, 'El identificador no puede estar vacio')
  .max(1500)
  .refine((v) => !v.includes('/'), 'El identificador no puede contener "/"')
