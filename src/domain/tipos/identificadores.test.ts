import { describe, expect, it } from 'vitest'
import { aTextoDeId, crearId, idDisponible } from './identificadores'

describe('aTextoDeId', () => {
  it('normaliza acentos, mayusculas y espacios', () => {
    expect(aTextoDeId('Plan 200 Sitios Nuevos')).toBe('plan-200-sitios-nuevos')
    expect(aTextoDeId('Densificación 5G')).toBe('densificacion-5g')
    expect(aTextoDeId('  Célula RF  ')).toBe('celula-rf')
  })

  it('colapsa simbolos y no deja guiones sueltos en los extremos', () => {
    expect(aTextoDeId('Obra  civil / energía')).toBe('obra-civil-energia')
    expect(aTextoDeId('---hola---')).toBe('hola')
  })

  it('acota el largo sin dejar un guion al final', () => {
    const largo = aTextoDeId('a'.repeat(80))
    expect(largo.length).toBeLessThanOrEqual(60)
    expect(largo.endsWith('-')).toBe(false)
  })

  it('devuelve vacio si no queda nada utilizable', () => {
    expect(aTextoDeId('!!! ???')).toBe('')
  })
})

describe('crearId', () => {
  it('antepone el prefijo de la coleccion', () => {
    expect(crearId('Plan 200', 'prog')).toBe('prog-plan-200')
  })

  it('nunca devuelve un id vacio', () => {
    const id = crearId('###', 'cel')
    expect(id.startsWith('cel-')).toBe(true)
    expect(id.length).toBeGreaterThan(4)
  })
})

describe('idDisponible', () => {
  it('devuelve el propuesto si esta libre', () => {
    expect(idDisponible('prog-plan-200', new Set())).toBe('prog-plan-200')
  })

  it('agrega un sufijo cuando ya existe', () => {
    expect(idDisponible('prog-plan-200', new Set(['prog-plan-200']))).toBe('prog-plan-200-2')
    expect(idDisponible('prog-plan-200', new Set(['prog-plan-200', 'prog-plan-200-2']))).toBe(
      'prog-plan-200-3',
    )
  })
})
