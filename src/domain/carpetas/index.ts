/**
 * Solicitud de carpeta de SharePoint por correo a Power Automate.
 *
 * El formato lo lee un flujo (docs/power-automate-carpetas.md), asi que las
 * reglas son estrictas: el asunto trae todo lo que el flujo necesita, en cuatro
 * partes separadas por " | ", y ninguna parte puede contener "|".
 */

export const PLANTILLA_ASUNTO_POR_DEFECTO = 'CREAR_CARPETA | {programa} | {sitioId} | {nombre}'

/** Largo practico de un mailto: algunos clientes de Windows cortan antes de 2.000. */
export const LARGO_MAXIMO_MAILTO = 1800

export interface DatosCarpeta {
  programa: string
  proyecto: string
  sitioId: string
  nombre: string
  comuna: string
  region: string
  solicitante: { nombre: string; email: string }
  /** dd-mm-aaaa */
  fecha: string
}

/** Una parte del asunto: sin "|" (rompe el formato) ni espacios de mas. */
export function limpiarParte(texto: string): string {
  return texto.replace(/\|/g, '-').replace(/\s+/g, ' ').trim()
}

export function asuntoCarpeta(plantilla: string, datos: DatosCarpeta): string {
  const valores: Record<string, string> = {
    programa: limpiarParte(datos.programa),
    sitioId: limpiarParte(datos.sitioId),
    nombre: limpiarParte(datos.nombre),
    proyecto: limpiarParte(datos.proyecto),
  }
  return plantilla.replace(/\{(\w+)\}/g, (_, clave: string) => valores[clave] ?? '')
}

/** El asunto tiene exactamente cuatro partes y empieza con CREAR_CARPETA. */
export function asuntoValido(asunto: string): boolean {
  const partes = asunto.split(' | ')
  return (
    partes.length === 4 && partes[0] === 'CREAR_CARPETA' && partes.every((p) => p.trim() !== '')
  )
}

export function cuerpoCarpeta(datos: DatosCarpeta): string {
  return [
    'Solicitud automática generada por PMO3000.',
    '',
    `Programa:  ${datos.programa}`,
    `Proyecto:  ${datos.proyecto}`,
    `ID sitio:  ${datos.sitioId}`,
    `Nombre:    ${datos.nombre}`,
    `Comuna:    ${datos.comuna}`,
    `Región:    ${datos.region}`,
    `Solicitado por: ${datos.solicitante.nombre} (${datos.solicitante.email})`,
    `Fecha: ${datos.fecha}`,
    '',
    'No modifiques el asunto: el flujo de Power Automate lo usa para crear la carpeta.',
  ].join('\n')
}

/**
 * El mailto: listo para abrir. Si con el cuerpo completo se pasa del largo
 * seguro, el cuerpo se acorta: lo que el flujo necesita va en el asunto.
 */
export function armarMailto(destinatario: string, asunto: string, cuerpo: string): string {
  const armar = (c: string) =>
    `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(c)}`
  const completo = armar(cuerpo)
  if (completo.length <= LARGO_MAXIMO_MAILTO) return completo
  return armar('Solicitud automática generada por PMO3000. No modifiques el asunto.')
}
