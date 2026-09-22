import { describe, expect, it } from 'vitest'
import {
  diasEntre,
  diasHabilesEntre,
  esFechaISO,
  formatearFecha,
  hoyEnChile,
  parsearFechaFlexible,
  sumarDias,
} from './index'

describe('esFechaISO', () => {
  it('acepta dias validos', () => {
    expect(esFechaISO('2026-02-28')).toBe(true)
    expect(esFechaISO('2024-02-29')).toBe(true)
  })

  it('rechaza dias que no existen', () => {
    expect(esFechaISO('2026-02-30')).toBe(false)
    expect(esFechaISO('2026-13-01')).toBe(false)
    expect(esFechaISO('2026-2-1')).toBe(false)
    expect(esFechaISO('01-02-2026')).toBe(false)
    expect(esFechaISO(20260201)).toBe(false)
  })
})

describe('hoyEnChile', () => {
  it('usa el reloj de Chile, no el del navegador', () => {
    // 2026-07-01 02:30 UTC = 2026-06-30 22:30 en Chile (UTC-4 en invierno).
    expect(hoyEnChile(new Date('2026-07-01T02:30:00Z'))).toBe('2026-06-30')
  })

  it('devuelve el mismo dia cuando no hay cruce de medianoche', () => {
    expect(hoyEnChile(new Date('2026-07-01T15:00:00Z'))).toBe('2026-07-01')
  })
})

describe('formatearFecha', () => {
  it('entrega dd-mm-aaaa', () => {
    expect(formatearFecha('2026-03-09')).toBe('09-03-2026')
  })

  it('no se corre un dia por zona horaria', () => {
    // Este es el bug que motiva guardar dias civiles como string.
    expect(formatearFecha('2026-01-01')).toBe('01-01-2026')
    expect(formatearFecha('2026-12-31')).toBe('31-12-2026')
  })

  it('tolera valores ausentes', () => {
    expect(formatearFecha(null)).toBe('—')
    expect(formatearFecha('basura')).toBe('—')
  })
})

describe('aritmetica de dias', () => {
  it('cuenta dias entre fechas', () => {
    expect(diasEntre('2026-01-01', '2026-01-31')).toBe(30)
    expect(diasEntre('2026-01-31', '2026-01-01')).toBe(-30)
    expect(diasEntre('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('cruza cambio de hora sin perder un dia', () => {
    // En Chile el horario de verano cambia en septiembre y abril.
    expect(diasEntre('2026-09-05', '2026-09-08')).toBe(3)
    expect(diasEntre('2026-04-03', '2026-04-06')).toBe(3)
  })

  it('suma dias cruzando meses y anos', () => {
    expect(sumarDias('2026-01-30', 2)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('cuenta dias habiles', () => {
    // lunes 2026-01-05 a lunes 2026-01-12 = 5 dias habiles.
    expect(diasHabilesEntre('2026-01-05', '2026-01-12')).toBe(5)
    expect(diasHabilesEntre('2026-01-10', '2026-01-12')).toBe(0)
  })
})

describe('parsearFechaFlexible', () => {
  it('lee formato chileno', () => {
    expect(parsearFechaFlexible('09-03-2026')).toBe('2026-03-09')
    expect(parsearFechaFlexible('9/3/2026')).toBe('2026-03-09')
    expect(parsearFechaFlexible('09.03.26')).toBe('2026-03-09')
  })

  it('lee formato ISO', () => {
    expect(parsearFechaFlexible('2026-03-09')).toBe('2026-03-09')
  })

  it('lee el numero de serie de Excel', () => {
    // 45000 = 2023-03-15 en el calendario de Excel.
    expect(parsearFechaFlexible(45000)).toBe('2023-03-15')
  })

  it('lee objetos Date', () => {
    expect(parsearFechaFlexible(new Date('2026-03-09T00:00:00Z'))).toBe('2026-03-09')
  })

  it('devuelve null ante basura', () => {
    expect(parsearFechaFlexible('proximo mes')).toBeNull()
    expect(parsearFechaFlexible('')).toBeNull()
    expect(parsearFechaFlexible(null)).toBeNull()
    expect(parsearFechaFlexible('31-02-2026')).toBeNull()
  })
})
