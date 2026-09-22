import { describe, expect, it } from 'vitest'
import {
  LARGO_MAXIMO_MAILTO,
  PLANTILLA_ASUNTO_POR_DEFECTO,
  armarMailto,
  asuntoCarpeta,
  asuntoValido,
  cuerpoCarpeta,
  type DatosCarpeta,
} from '.'

const DATOS: DatosCarpeta = {
  programa: 'Plan 200 sitios nuevos',
  proyecto: 'Plan 200 - Metropolitana',
  sitioId: 'RM-0421',
  nombre: 'Cerro Azul 43',
  comuna: 'Maipú',
  region: 'Metropolitana de Santiago',
  solicitante: { nombre: 'Ana Pérez', email: 'ana.perez@clarovtr.cl' },
  fecha: '21-09-2026',
}

describe('asuntoCarpeta', () => {
  it('arma el formato exacto que lee el flujo', () => {
    const asunto = asuntoCarpeta(PLANTILLA_ASUNTO_POR_DEFECTO, DATOS)
    expect(asunto).toBe('CREAR_CARPETA | Plan 200 sitios nuevos | RM-0421 | Cerro Azul 43')
    expect(asuntoValido(asunto)).toBe(true)
  })

  it('un "|" en el nombre no rompe las cuatro partes', () => {
    const asunto = asuntoCarpeta(PLANTILLA_ASUNTO_POR_DEFECTO, {
      ...DATOS,
      nombre: 'Cerro | Azul  43 ',
    })
    expect(asunto).toBe('CREAR_CARPETA | Plan 200 sitios nuevos | RM-0421 | Cerro - Azul 43')
    expect(asuntoValido(asunto)).toBe(true)
  })

  it('reconoce un asunto mal formado', () => {
    expect(asuntoValido('CREAR_CARPETA | Plan | RM-0421')).toBe(false)
    expect(asuntoValido('OTRA_COSA | a | b | c')).toBe(false)
  })
})

describe('armarMailto', () => {
  it('lleva destinatario, asunto y cuerpo codificados', () => {
    const url = armarMailto('pmo.carpetas@clarovtr.cl', 'A | B', cuerpoCarpeta(DATOS))
    expect(url.startsWith('mailto:pmo.carpetas%40clarovtr.cl?subject=A%20%7C%20B&body=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('ID sitio:  RM-0421')
  })

  it('acorta el cuerpo si el enlace se pasa del largo seguro', () => {
    const url = armarMailto('x@clarovtr.cl', 'A | B | C | D', 'x'.repeat(3000))
    expect(url.length).toBeLessThanOrEqual(LARGO_MAXIMO_MAILTO)
    expect(url).toContain('subject=A%20%7C%20B%20%7C%20C%20%7C%20D')
  })
})
