import { describe, expect, it } from 'vitest'
import {
  dominioDe,
  esAccesoPermitido,
  esAdministradorInicial,
  esDominioPermitido,
  esEmailValido,
  textoDominios,
  listaDeCorreos,
  mensajeAccesoDenegado,
  normalizarEmail,
  rolInicial,
  type PoliticaAcceso,
} from './dominio'

const POLITICA: PoliticaAcceso = {
  dominios: ['clarovtr.cl', 'claro.cl'],
  correosAdmin: ['javier.neo@gmail.com'],
}

describe('esDominioPermitido', () => {
  it('acepta el dominio corporativo', () => {
    expect(esDominioPermitido('persona@clarovtr.cl', 'clarovtr.cl')).toBe(true)
    expect(esDominioPermitido('  Persona@ClaroVTR.CL ', 'clarovtr.cl')).toBe(true)
  })

  it('rechaza otros dominios', () => {
    expect(esDominioPermitido('persona@gmail.com', 'clarovtr.cl')).toBe(false)
    expect(esDominioPermitido('persona@claro.cl', 'clarovtr.cl')).toBe(false)
    expect(esDominioPermitido('persona@claro.com', ['clarovtr.cl', 'claro.cl'])).toBe(false)
    expect(esDominioPermitido('persona@vtr.cl', 'clarovtr.cl')).toBe(false)
  })

  it('acepta cualquiera de los dominios de la lista', () => {
    expect(esDominioPermitido('persona@claro.cl', ['clarovtr.cl', 'claro.cl'])).toBe(true)
    expect(esDominioPermitido('persona@clarovtr.cl', ['clarovtr.cl', 'claro.cl'])).toBe(true)
    expect(esDominioPermitido('persona@noclaro.cl', ['clarovtr.cl', 'claro.cl'])).toBe(false)
  })

  it('un subdominio entra solo si esta en la lista', () => {
    const lista = ['clarovtr.cl', 'e.clarovtr.cl', 'claro.cl']
    expect(esDominioPermitido('felipe@e.clarovtr.cl', lista)).toBe(true)
    expect(esDominioPermitido('felipe@e.clarovtr.cl', ['clarovtr.cl', 'claro.cl'])).toBe(false)
    expect(esDominioPermitido('felipe@x.clarovtr.cl', lista)).toBe(false)
  })

  it('rechaza dominios que solo terminan parecido', () => {
    // El sufijo no basta: "noclarovtr.cl" no es "clarovtr.cl".
    expect(esDominioPermitido('persona@noclarovtr.cl', 'clarovtr.cl')).toBe(false)
    expect(esDominioPermitido('persona@clarovtr.cl.evil.com', 'clarovtr.cl')).toBe(false)
  })

  it('rechaza correos mal formados', () => {
    expect(esDominioPermitido('sin-arroba', 'clarovtr.cl')).toBe(false)
    expect(esDominioPermitido('doble@@clarovtr.cl', 'clarovtr.cl')).toBe(false)
    expect(esDominioPermitido('', 'clarovtr.cl')).toBe(false)
  })
})

describe('administradores externos', () => {
  it('reconoce el correo autorizado, sin importar mayusculas ni espacios', () => {
    expect(esAdministradorInicial('javier.neo@gmail.com', POLITICA.correosAdmin)).toBe(true)
    expect(esAdministradorInicial('  Javier.Neo@Gmail.com ', POLITICA.correosAdmin)).toBe(true)
  })

  it('no autoriza a cualquier gmail', () => {
    expect(esAdministradorInicial('otro@gmail.com', POLITICA.correosAdmin)).toBe(false)
  })

  it('deja entrar tanto al dominio como a la lista', () => {
    expect(esAccesoPermitido('persona@clarovtr.cl', POLITICA)).toBe(true)
    expect(esAccesoPermitido('persona@claro.cl', POLITICA)).toBe(true)
    expect(esAccesoPermitido('javier.neo@gmail.com', POLITICA)).toBe(true)
    expect(esAccesoPermitido('otro@gmail.com', POLITICA)).toBe(false)
  })

  it('el de la lista entra como admin y el resto como lector', () => {
    expect(rolInicial('javier.neo@gmail.com', POLITICA)).toBe('admin')
    expect(rolInicial('persona@clarovtr.cl', POLITICA)).toBe('lector')
  })

  it('sin lista, solo manda el dominio', () => {
    const soloDominio: PoliticaAcceso = { dominios: ['clarovtr.cl'], correosAdmin: [] }
    expect(esAccesoPermitido('javier.neo@gmail.com', soloDominio)).toBe(false)
    expect(rolInicial('persona@clarovtr.cl', soloDominio)).toBe('lector')
  })
})

describe('listaDeCorreos', () => {
  it('parsea la variable de entorno', () => {
    expect(listaDeCorreos('a@b.cl, C@D.CL ,')).toEqual(['a@b.cl', 'c@d.cl'])
    expect(listaDeCorreos(undefined)).toEqual([])
    expect(listaDeCorreos('')).toEqual([])
  })
})

describe('mensajeAccesoDenegado', () => {
  it('menciona la excepcion solo si existe', () => {
    expect(mensajeAccesoDenegado(POLITICA)).toContain('cuenta autorizada')
    expect(mensajeAccesoDenegado({ dominios: ['clarovtr.cl'], correosAdmin: [] })).not.toContain(
      'cuenta autorizada',
    )
  })
})

describe('textoDominios', () => {
  it('arma el texto de los mensajes', () => {
    expect(textoDominios(['clarovtr.cl', 'claro.cl'])).toBe('@clarovtr.cl o @claro.cl')
    expect(textoDominios(['clarovtr.cl'])).toBe('@clarovtr.cl')
  })
})

describe('utilidades de correo', () => {
  it('normaliza', () => {
    expect(normalizarEmail('  A@B.CL ')).toBe('a@b.cl')
  })

  it('extrae el dominio', () => {
    expect(dominioDe('a@clarovtr.cl')).toBe('clarovtr.cl')
    expect(dominioDe('mal')).toBeNull()
  })

  it('valida la forma del correo', () => {
    expect(esEmailValido('a@b.cl')).toBe(true)
    expect(esEmailValido('a@b')).toBe(false)
  })
})
