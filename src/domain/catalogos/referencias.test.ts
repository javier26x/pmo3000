import { describe, expect, it } from 'vitest'
import {
  REFERENCIAS,
  TIPOS_ELIMINABLES,
  describirReferencias,
  parcheDesnormalizado,
  sumarConteos,
  totalReferencias,
} from './referencias'

describe('REFERENCIAS', () => {
  it('declara al menos una referencia para cada tipo eliminable', () => {
    for (const tipo of TIPOS_ELIMINABLES) {
      expect(REFERENCIAS[tipo].length).toBeGreaterThan(0)
    }
  })

  it('un proyecto se considera usado si tiene sitios en seguimiento', () => {
    expect(REFERENCIAS.proyecto).toContainEqual({
      coleccion: 'sitioProyectos',
      campo: 'proyectoId',
    })
  })

  it('un programa se considera usado si tiene proyectos', () => {
    expect(REFERENCIAS.programa).toContainEqual({ coleccion: 'proyectos', campo: 'programaId' })
  })
})

describe('totalReferencias', () => {
  it('suma todas las colecciones', () => {
    expect(totalReferencias({})).toBe(0)
    expect(totalReferencias({ proyectos: 2, usuarios: 1 })).toBe(3)
  })
})

describe('sumarConteos', () => {
  it('acumula por coleccion y descarta los ceros', () => {
    expect(
      sumarConteos([
        { coleccion: 'proyectos', cantidad: 2 },
        { coleccion: 'proyectos', cantidad: 1 },
        { coleccion: 'usuarios', cantidad: 0 },
      ]),
    ).toEqual({ proyectos: 3 })
  })
})

describe('describirReferencias', () => {
  it('vacio cuando no hay nada', () => {
    expect(describirReferencias({})).toBe('')
  })

  it('usa singular y plural', () => {
    expect(describirReferencias({ sitioProyectos: 1 })).toBe('1 sitio en seguimiento')
    expect(describirReferencias({ sitioProyectos: 4 })).toBe('4 sitios en seguimiento')
  })

  it('enumera con comas y una y final', () => {
    expect(describirReferencias({ usuarios: 1, proyectos: 2 })).toBe('2 proyectos y 1 usuario')
    expect(describirReferencias({ usuarios: 1, proyectos: 2, tareas: 3 })).toBe(
      '2 proyectos, 1 usuario y 3 tareas',
    )
  })
})

describe('parcheDesnormalizado', () => {
  const base = { nombre: 'Cerro', region: 'RM', comuna: 'Maipu', lat: -33.5, lon: -70.7 }

  it('null si no cambio ningun campo copiado', () => {
    expect(parcheDesnormalizado(base, { ...base })).toBeNull()
  })

  it('reescribe todos los campos copiados con el nombre de destino', () => {
    expect(parcheDesnormalizado(base, { ...base, nombre: 'Cerro Alto' })).toEqual({
      sitioNombre: 'Cerro Alto',
      region: 'RM',
      comuna: 'Maipu',
      lat: -33.5,
      lon: -70.7,
    })
  })
})
