/**
 * La torrera del sitio: la empresa duena de la infraestructura (ATC, SITES,
 * ATP, Centennial...), que en la PMO se llama OOII.
 *
 * No es un campo propio de la app: viene del tracker, y cada tracker le pone
 * otro nombre. El Plan 200 la llama "Operador Vigente", el control de RWK "OOII
 * Nuevo". Se busca entre los valores importados del seguimiento, sin reimportar
 * nada. La vigente manda sobre la anterior: en un RWK la que importa es la del
 * sitio nuevo.
 */
import type { SitioProyecto } from '@/domain/tipos'

/** Ids de campo conocidos, en orden de preferencia (salen de idDeEncabezado). */
const CONOCIDOS = [
  'torrera',
  'ooii-nuevo',
  'ooii-vigente',
  'operador-vigente',
  'ooii',
  'operador',
  'torrera-vigente',
  'empresa-torrera',
  'propietario-torre',
]

/** Un id que nombra a la torrera y no a otra cosa de ella (su ID, su fecha, su revision). */
const RE_TORRERA = /(^|-)(torrera|ooii|operador)(-|$)/
const RE_NO_ES =
  /(^|-)(anterior|antiguo|id|status|estado|comentarios?|fecha|rfi|ing|informado|fc|forecast)(-|$)/

const VACIOS = new Set(['', '-', '´-', 'n/a', 'na', 'sin informacion', 'sin información', 'tbd'])

function valorUtil(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return VACIOS.has(t.toLowerCase()) ? null : t
}

export function torreraDe(valores: SitioProyecto['valores'] | undefined): string | null {
  if (!valores) return null
  for (const id of CONOCIDOS) {
    const v = valorUtil(valores[id])
    if (v !== null) return v
  }
  for (const [id, valor] of Object.entries(valores)) {
    if (!RE_TORRERA.test(id) || RE_NO_ES.test(id)) continue
    const v = valorUtil(valor)
    if (v !== null) return v
  }
  return null
}
