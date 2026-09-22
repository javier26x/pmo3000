import { describe, expect, it } from 'vitest'
import { lunesDe, ritmoSemanal } from './ritmo'
import { sitioProyecto } from '@/pruebas/fabricas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

describe('lunesDe', () => {
  it('lleva cualquier dia al lunes de su semana', () => {
    expect(lunesDe('2026-09-22')).toBe('2026-09-21') // martes
    expect(lunesDe('2026-09-21')).toBe('2026-09-21') // lunes
    expect(lunesDe('2026-09-27')).toBe('2026-09-21') // domingo
  })
})

describe('ritmoSemanal', () => {
  function conCierres(fechas: Record<string, string>, extra: Partial<SitioProyecto> = {}) {
    const base = sitioProyecto(extra)
    const gates = { ...base.gates }
    for (const [codigo, fecha] of Object.entries(fechas)) {
      gates[codigo] = { ...gates[codigo]!, estado: 'completado', fechaReal: fecha }
    }
    return { ...base, gates }
  }

  it('cuenta las etapas cerradas por semana, de la mas antigua a la actual', () => {
    const lista = [
      conCierres({ TSSR: '2026-09-22', FC: '2026-09-15' }),
      conCierres({ TSSR: '2026-09-16' }),
    ]
    const r = ritmoSemanal(lista, '2026-09-23', 3)
    expect(r.map((s) => s.inicio)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21'])
    expect(r.map((s) => s.cerradas)).toEqual([0, 2, 1])
  })

  it('ignora lo que cae fuera de la ventana y los sitios no vigentes', () => {
    const lista = [
      conCierres({ TSSR: '2025-01-01' }),
      conCierres({ TSSR: '2026-09-22' }, { vigente: false }),
    ]
    expect(ritmoSemanal(lista, '2026-09-23', 4).every((s) => s.cerradas === 0)).toBe(true)
  })
})
