import { describe, expect, it } from 'vitest'
import { diasAtraso, semaforo, textoAtraso } from './atraso'

describe('diasAtraso', () => {
  it('es positivo cuando el plan ya vencio', () => {
    expect(diasAtraso('2026-01-10', null, '2026-01-15')).toBe(5)
  })

  it('es negativo cuando aun hay plazo', () => {
    expect(diasAtraso('2026-01-20', null, '2026-01-15')).toBe(-5)
  })

  it('se congela contra la fecha real y no sigue creciendo', () => {
    expect(diasAtraso('2026-01-10', '2026-01-12', '2026-03-01')).toBe(2)
  })

  it('es null sin fecha plan', () => {
    expect(diasAtraso(null, null, '2026-01-15')).toBeNull()
  })
})

describe('semaforo', () => {
  it('clasifica el estado del compromiso', () => {
    expect(semaforo('2026-01-10', null, '2026-01-15')).toBe('atrasado')
    // El dia del compromiso todavia no es atraso: vence hoy.
    expect(semaforo('2026-01-15', null, '2026-01-15')).toBe('por_vencer')
    expect(semaforo('2026-01-17', null, '2026-01-15')).toBe('por_vencer')
    expect(semaforo('2026-02-15', null, '2026-01-15')).toBe('ok')
    expect(semaforo(null, null, '2026-01-15')).toBe('sin_fecha')
  })
})

describe('textoAtraso', () => {
  it('describe el atraso en castellano', () => {
    expect(textoAtraso(12)).toBe('12 d atraso')
    expect(textoAtraso(0)).toBe('vence hoy')
    expect(textoAtraso(-3)).toBe('en 3 d')
    expect(textoAtraso(null)).toBe('—')
  })
})
