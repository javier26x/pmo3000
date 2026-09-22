import { describe, expect, it } from 'vitest'
import { dominioDe, esDominioPermitido, esEmailValido, normalizarEmail } from './dominio'

describe('esDominioPermitido', () => {
  it('acepta el dominio corporativo', () => {
    expect(esDominioPermitido('persona@claro.cl', 'claro.cl')).toBe(true)
    expect(esDominioPermitido('  Persona@Claro.CL ', 'claro.cl')).toBe(true)
  })

  it('rechaza otros dominios', () => {
    expect(esDominioPermitido('persona@gmail.com', 'claro.cl')).toBe(false)
    expect(esDominioPermitido('persona@proveedor.cl', 'claro.cl')).toBe(false)
  })

  it('rechaza dominios que solo terminan parecido', () => {
    // El sufijo no basta: "noclaro.cl" no es "claro.cl".
    expect(esDominioPermitido('persona@noclaro.cl', 'claro.cl')).toBe(false)
    expect(esDominioPermitido('persona@claro.cl.evil.com', 'claro.cl')).toBe(false)
  })

  it('rechaza correos mal formados', () => {
    expect(esDominioPermitido('sin-arroba', 'claro.cl')).toBe(false)
    expect(esDominioPermitido('doble@@claro.cl', 'claro.cl')).toBe(false)
    expect(esDominioPermitido('', 'claro.cl')).toBe(false)
  })
})

describe('utilidades de correo', () => {
  it('normaliza', () => {
    expect(normalizarEmail('  A@B.CL ')).toBe('a@b.cl')
  })

  it('extrae el dominio', () => {
    expect(dominioDe('a@claro.cl')).toBe('claro.cl')
    expect(dominioDe('mal')).toBeNull()
  })

  it('valida la forma del correo', () => {
    expect(esEmailValido('a@b.cl')).toBe(true)
    expect(esEmailValido('a@b')).toBe(false)
  })
})
