import { z } from 'zod'
import { esquemaSellos } from './base'

/**
 * Un area que revisa etapas: OOCC, ECE, RF, Implementacion, MMOO.
 *
 * En los trackers cada etapa (TSS, Ingenieria, As Built) la revisan varias
 * areas, cada una con su estado. El area es el catalogo que une esas columnas
 * con las personas que tienen que responder: con eso cada una ve lo que le toca.
 */
export const esquemaArea = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    /**
     * Como aparece en los trackers ("Implementacion", "IMPL"). Con el nombre y
     * el id, es lo que calza una revision importada con esta area.
     */
    alias: z.array(z.string()).default([]),
    /** Quienes responden por defecto. */
    responsables: z.array(z.string()).default([]),
    /** Proyecto -> quienes responden en ESE proyecto. Manda sobre el defecto. */
    porProyecto: z.record(z.string(), z.array(z.string())).default({}),
    activa: z.boolean().default(true),
  })
  .extend(esquemaSellos.shape)
export type Area = z.infer<typeof esquemaArea>

/**
 * Las areas de los trackers de la PMO, para crearlas de una vez.
 *
 * Las cinco primeras revisan TSS, Ingenieria y As Built. FO, MMOO e IPRAN son
 * ademas los equipos de transmision de la PMO: con la construccion lista, la Tx
 * pendiente es de FO o de MMOO segun el "Tipo Tx" del sitio (los alias son los
 * valores de esa columna) y la IPRAN pendiente es de IPRAN.
 */
export const AREAS_SEMILLA: { id: string; nombre: string; alias: string[] }[] = [
  { id: 'oocc', nombre: 'OOCC', alias: ['OOCC', 'Obras civiles'] },
  { id: 'ece', nombre: 'ECE', alias: ['ECE'] },
  { id: 'rf', nombre: 'RF', alias: ['RF', 'Radiofrecuencia'] },
  { id: 'implementacion', nombre: 'Implementación', alias: ['Implementacion', 'IMPL'] },
  { id: 'mmoo', nombre: 'MMOO', alias: ['MMOO', 'Microondas'] },
  { id: 'fo', nombre: 'FO', alias: ['FO', 'Fibra', 'Fibra óptica'] },
  { id: 'ipran', nombre: 'IPRAN', alias: ['IPRAN', 'UAN'] },
]
