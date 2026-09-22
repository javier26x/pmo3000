import { describe, expect, it } from 'vitest'
import { actor } from '@/pruebas/fabricas'
import type { Alcance, Rol } from '@/domain/tipos/comunes'
import {
  alcanceVacio,
  describirAlcance,
  disyuncionesAlcance,
  estaEnAlcance,
  mismoAlcance,
  planAlcance,
  normalizarAlcance,
  serializarAlcance,
  tieneAlcance,
  totalEntradas,
  validarAlcance,
  MAX_ENTRADAS_ALCANCE,
} from './alcance'

const acotado = (alcance: Partial<Alcance>, rol: Rol = 'analista') =>
  actor(rol, { alcance: { ...alcanceVacio(), ...alcance } })

const sp = (celulaId: string | null, programaId: string | null, proyectoId: string | null) => ({
  celulaId,
  programaId,
  proyectoId,
})

const nombres = {
  celula: (id: string) => id.toUpperCase(),
  programa: (id: string) => `P${id}`,
  proyecto: (id: string) => id,
}

describe('tieneAlcance', () => {
  it('sin listas no hay restriccion', () => {
    expect(tieneAlcance(actor('analista'))).toBe(false)
  })

  it('con cualquier lista hay restriccion', () => {
    expect(tieneAlcance(acotado({ proyectos: ['x'] }))).toBe(true)
  })

  it('al admin nunca se le aplica', () => {
    expect(tieneAlcance(acotado({ celulas: ['c1'] }, 'admin'))).toBe(false)
    expect(tieneAlcance({ rol: 'admin', alcance: { ...alcanceVacio(), celulas: ['c1'] } })).toBe(
      false,
    )
  })

  it('un perfil sin el campo cuenta como sin restriccion', () => {
    expect(tieneAlcance({ rol: 'jefe_celula' })).toBe(false)
  })
})

describe('estaEnAlcance', () => {
  const a = acotado({ celulas: ['c1'], programas: ['p1'], proyectos: ['q1'] })

  it('basta con que calce una de las tres listas', () => {
    expect(estaEnAlcance(a, sp('c1', 'otro', 'otro'))).toBe(true)
    expect(estaEnAlcance(a, sp('otra', 'p1', 'otro'))).toBe(true)
    expect(estaEnAlcance(a, sp(null, 'otro', 'q1'))).toBe(true)
  })

  it('fuera de las tres listas queda fuera', () => {
    expect(estaEnAlcance(a, sp('c2', 'p2', 'q2'))).toBe(false)
    expect(estaEnAlcance(a, sp(null, 'p2', 'q2'))).toBe(false)
  })

  it('sin alcance todo esta dentro', () => {
    expect(estaEnAlcance(actor('lector'), sp('c9', 'p9', 'q9'))).toBe(true)
  })
})

describe('disyuncionesAlcance', () => {
  it('una disyuncion por lista no vacia', () => {
    expect(disyuncionesAlcance(acotado({ celulas: ['c1', 'c2'], proyectos: ['q1'] }))).toEqual([
      { campo: 'celulaId', valores: ['c1', 'c2'] },
      { campo: 'proyectoId', valores: ['q1'] },
    ])
  })

  it('null si no esta acotado', () => {
    expect(disyuncionesAlcance(actor('jefe_celula'))).toBeNull()
  })
})

describe('planAlcance', () => {
  const a = acotado({ programas: ['p2'], proyectos: ['q1'] })

  it('sin igualdades lleva el or() completo', () => {
    expect(planAlcance(a, {})).toEqual({
      tipo: 'disyunciones',
      disyunciones: [
        { campo: 'programaId', valores: ['p2'] },
        { campo: 'proyectoId', valores: ['q1'] },
      ],
    })
  })

  it('una igualdad dentro de la lista prueba sola el alcance', () => {
    expect(planAlcance(a, { programaId: 'p2' })).toEqual({ tipo: 'sinRestriccion' })
  })

  it('una igualdad fuera de la lista quita esa disyuncion', () => {
    expect(planAlcance(a, { programaId: 'p1', sitioId: 'S' })).toEqual({
      tipo: 'disyunciones',
      disyunciones: [{ campo: 'proyectoId', valores: ['q1'] }],
    })
  })

  it('si no queda ninguna disyuncion no hay nada que consultar', () => {
    expect(planAlcance(a, { programaId: 'p1', proyectoId: 'q9' })).toEqual({ tipo: 'vacio' })
  })

  it('sin alcance no se acota', () => {
    expect(planAlcance(actor('analista'), { programaId: 'p1' })).toEqual({
      tipo: 'sinRestriccion',
    })
  })
})

describe('validacion y normalizacion', () => {
  it('limpia vacios y repetidos', () => {
    expect(normalizarAlcance({ celulas: ['b', ' a ', 'b', ''] })).toEqual({
      celulas: ['a', 'b'],
      programas: [],
      proyectos: [],
    })
  })

  it('rechaza pasar del tope de Firestore', () => {
    const muchas = Array.from({ length: MAX_ENTRADAS_ALCANCE }, (_, i) => `c${i}`)
    expect(validarAlcance({ ...alcanceVacio(), celulas: muchas })).toBeNull()
    expect(validarAlcance({ ...alcanceVacio(), celulas: muchas, proyectos: ['q'] })).toMatch(
      /máximo 30/,
    )
    expect(totalEntradas({ ...alcanceVacio(), celulas: muchas, proyectos: ['q'] })).toBe(31)
  })

  it('compara sin importar el orden', () => {
    expect(
      mismoAlcance(
        { ...alcanceVacio(), celulas: ['a', 'b'] },
        { ...alcanceVacio(), celulas: ['b', 'a'] },
      ),
    ).toBe(true)
    expect(serializarAlcance(alcanceVacio())).toBe('Todo')
    expect(serializarAlcance({ ...alcanceVacio(), programas: ['p1'] })).toBe(
      'celulas: - | programas: p1 | proyectos: -',
    )
  })
})

describe('describirAlcance', () => {
  it('"Todo" cuando no hay restriccion', () => {
    expect(describirAlcance(alcanceVacio(), nombres)).toBe('Todo')
  })

  it('resume las primeras entradas y cuenta el resto', () => {
    const a = { celulas: ['norte'], programas: ['1', '2'], proyectos: ['x'] }
    expect(describirAlcance(a, nombres)).toBe('Célula NORTE, Programa P1 y 2 más')
    expect(describirAlcance(a, nombres, 10)).toBe(
      'Célula NORTE, Programa P1, Programa P2, Proyecto x',
    )
  })
})
