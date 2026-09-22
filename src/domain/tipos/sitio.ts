import { z } from 'zod'
import { esquemaSellos, zIdFirestore } from './base'

/** Rango geografico de Chile, incluida Isla de Pascua (lon -109,4). */
export const LIMITES_CHILE = { latMin: -56.5, latMax: -17.3, lonMin: -110, lonMax: -66 } as const

export const esquemaSitio = z
  .object({
    /** El id del documento ES el ID de sitio real (ej. "STGO-0421"). */
    id: zIdFirestore,
    nombre: z.string().min(1, 'El nombre del sitio es obligatorio'),
    region: z.string().min(1, 'La region es obligatoria'),
    comuna: z.string().min(1, 'La comuna es obligatoria'),
    direccion: z.string(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    tecnologias: z.array(z.string()),
    tipoSitio: z.string(),
    /** URL de la carpeta en SharePoint. Editable a mano (Fase 2 la prellena). */
    carpetaUrl: z.string().nullable(),
    activo: z.boolean(),
  })
  .extend(esquemaSellos.shape)

export type Sitio = z.infer<typeof esquemaSitio>

export const esquemaSitioNuevo = esquemaSitio.omit({
  creadoEn: true,
  creadoPor: true,
  actualizadoEn: true,
  actualizadoPor: true,
})
export type SitioNuevo = z.infer<typeof esquemaSitioNuevo>

export function estaEnChile(lat: number, lon: number): boolean {
  return (
    lat >= LIMITES_CHILE.latMin &&
    lat <= LIMITES_CHILE.latMax &&
    lon >= LIMITES_CHILE.lonMin &&
    lon <= LIMITES_CHILE.lonMax
  )
}
