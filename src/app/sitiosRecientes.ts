const CLAVE_RECIENTES = 'pmo3000.sitiosRecientes'

/** Cuantos sitios recuerda la lista. Seis entran sin hacer scroll en la paleta. */
const TOPE_RECIENTES = 6

/**
 * Los ultimos sitios abiertos, para que la paleta los ofrezca antes de escribir
 * y el Inicio los muestre como accesos directos.
 *
 * Vive aparte de PaletaComandos porque el Inicio y la tabla lo leen, y la paleta
 * se carga bajo demanda: si estuviera en su modulo, un import de estas dos
 * funciones arrastraria la paleta entera al trozo inicial y la carga diferida no
 * serviria de nada.
 *
 * Es por navegador y no se sincroniza: perderlo no cuesta nada, asi que todo
 * error de almacenamiento (modo privado, cuota llena) se traga en silencio.
 */
export function leerRecientes(): string[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]')
    return Array.isArray(crudo) ? crudo.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordarSitio(sitioId: string): void {
  try {
    const previos = leerRecientes().filter((id) => id !== sitioId)
    localStorage.setItem(
      CLAVE_RECIENTES,
      JSON.stringify([sitioId, ...previos].slice(0, TOPE_RECIENTES)),
    )
  } catch {
    // sin almacenamiento: los recientes valen solo para esta sesión
  }
}
