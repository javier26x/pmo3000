import { describe, expect, it } from 'vitest'
import { torreraDe } from './torrera'

describe('torreraDe', () => {
  it('lee el "Operador Vigente" del Plan 200', () => {
    expect(torreraDe({ 'operador-anterior': 'ENTEL', 'operador-vigente': 'ATC' })).toBe('ATC')
  })

  it('en el control de RWK manda la del sitio nuevo', () => {
    expect(torreraDe({ 'ooii-antiguo': 'SITES', 'ooii-nuevo': 'CENTENNIAL' })).toBe('CENTENNIAL')
  })

  it('un "-" no es una torrera: cae a la siguiente columna que sirva', () => {
    expect(torreraDe({ 'ooii-nuevo': '-', ooii: 'ATP' })).toBe('ATP')
  })

  it('reconoce otros nombres, pero no el ID, la revision ni la fecha de la torrera', () => {
    expect(torreraDe({ 'status-ing-ooii': 'Ing Aprobada', 'id-ooii-nuevo': 'CL-1' })).toBeNull()
    expect(torreraDe({ 'ooii-del-sitio': 'PTI' })).toBe('PTI')
  })

  it('sin dato devuelve null', () => {
    expect(torreraDe({})).toBeNull()
    expect(torreraDe(undefined)).toBeNull()
  })
})
