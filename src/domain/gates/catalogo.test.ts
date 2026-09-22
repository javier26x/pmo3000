import { describe, expect, it } from 'vitest'
import { pasosDeGates } from './catalogo'

describe('pasosDeGates', () => {
  it('encadena las secuenciales por orden y deja fuera las paralelas', () => {
    const gates = {
      ON_AIR: { orden: 30 },
      TSS: { orden: 0 },
      FC: { orden: 5, tipo: 'paralela' as const },
      INGENIERIA: { orden: 10 },
    }
    expect(pasosDeGates(gates)).toEqual({ TSS: 'INGENIERIA', INGENIERIA: 'ON_AIR', ON_AIR: null })
  })
})
