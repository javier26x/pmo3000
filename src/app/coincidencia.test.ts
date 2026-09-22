import { describe, expect, it } from 'vitest'
import { normalizar, ordenarPorCoincidencia, puntuar } from './coincidencia'

describe('normalizar', () => {
  it('quita acentos y mayusculas', () => {
    expect(normalizar('  Peñalolén ')).toBe('penalolen')
  })
})

describe('puntuar', () => {
  it('devuelve null si no hay coincidencia', () => {
    expect(puntuar('Cerro Azul', 'mapa')).toBeNull()
  })

  it('prefiere el prefijo por sobre el medio de la palabra', () => {
    const prefijo = puntuar('RM-0421', 'rm') as number
    const medio = puntuar('ANT-RM-9', 'rm') as number
    expect(prefijo).toBeGreaterThan(medio)
  })

  it('prefiere el inicio de palabra por sobre el medio', () => {
    const inicioPalabra = puntuar('Cerro Azul', 'azul') as number
    const medioPalabra = puntuar('Azulado interior', 'zul') as number
    expect(inicioPalabra).toBeGreaterThan(medioPalabra)
  })

  it('la coincidencia exacta gana siempre', () => {
    expect(puntuar('RM-0421', 'RM-0421')).toBe(1000)
  })

  it('ignora acentos al comparar', () => {
    expect(puntuar('Peñalolén', 'penalolen')).not.toBeNull()
  })

  it('una consulta vacia no descarta nada', () => {
    expect(puntuar('lo que sea', '')).toBe(0)
  })
})

describe('ordenarPorCoincidencia', () => {
  const sitios = [
    { id: 'ANT-0100', nombre: 'Vega Sur' },
    { id: 'RM-0421', nombre: 'Cerro Azul' },
    { id: 'VAL-0999', nombre: 'Loma RM Vieja' },
  ]
  const textos = (s: (typeof sitios)[number]) => [s.id, s.nombre]

  it('pone primero el prefijo del ID', () => {
    const r = ordenarPorCoincidencia(sitios, 'rm', textos, 10)
    expect(r[0]?.id).toBe('RM-0421')
  })

  it('busca tambien por nombre', () => {
    const r = ordenarPorCoincidencia(sitios, 'azul', textos, 10)
    expect(r).toHaveLength(1)
    expect(r[0]?.id).toBe('RM-0421')
  })

  it('respeta el tope', () => {
    expect(ordenarPorCoincidencia(sitios, '', textos, 2)).toHaveLength(2)
  })

  it('sin coincidencias devuelve vacio', () => {
    expect(ordenarPorCoincidencia(sitios, 'inexistente', textos, 10)).toEqual([])
  })
})
