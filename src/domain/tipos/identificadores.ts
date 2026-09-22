/**
 * Identificadores de documento legibles.
 *
 * En Firestore el id va en la ruta, así que se ve en la consola, en los enlaces
 * y en la auditoría. `prog-plan-200-sitios-nuevos` dice qué es de un vistazo;
 * `xK3mZ9qLpA` obliga a abrir el documento para saberlo. Solo se generan al
 * crear: renombrar después cambia el nombre, nunca el id.
 */

const MAXIMO = 60

export function aTextoDeId(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAXIMO)
    .replace(/-+$/g, '')
}

/**
 * Id a partir del nombre, con prefijo por colección. Si el nombre no deja nada
 * utilizable (solo símbolos, por ejemplo) se cae a un sufijo aleatorio, que es
 * feo pero válido; nunca devuelve un id vacío.
 */
export function crearId(nombre: string, prefijo: string): string {
  const base = aTextoDeId(nombre)
  const cuerpo = base === '' ? Math.random().toString(36).slice(2, 10) : base
  return `${prefijo}-${cuerpo}`
}

/** Evita pisar un documento existente agregando -2, -3, … */
export function idDisponible(propuesto: string, usados: ReadonlySet<string>): string {
  if (!usados.has(propuesto)) return propuesto
  for (let i = 2; i < 500; i += 1) {
    const candidato = `${propuesto}-${i}`
    if (!usados.has(candidato)) return candidato
  }
  return `${propuesto}-${Date.now()}`
}
