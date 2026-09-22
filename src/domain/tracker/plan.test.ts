import { describe, expect, it } from 'vitest'
import { filaEnPlan, planDeFase, resumirPlanes } from './plan'
import type { FilaTracker } from './aplicacion'

/** Valores reales de la columna "Proyecto" del tracker Outdoor. */
describe('planDeFase', () => {
  it('separa el plan de la condicion del sitio', () => {
    expect(planDeFase('Plan 2025-2026')?.etiqueta).toBe('Plan 2025-2026')
    expect(planDeFase('Fase 2 - On Hold RF')?.etiqueta).toBe('Fase 2')
    expect(planDeFase('Plan 160- On Hold')?.etiqueta).toBe('Plan 160')
    expect(planDeFase('5G - On Hold RF')?.etiqueta).toBe('5G')
    expect(planDeFase('Fase 1 - Eliminado RF')?.etiqueta).toBe('Fase 1')
    expect(planDeFase('Indoor - On hold')?.etiqueta).toBe('Indoor')
    expect(planDeFase('5G - Implementado en 26GHZ')?.etiqueta).toBe('5G')
  })

  it('no inventa un plan donde el tracker ya lo perdio', () => {
    for (const fase of ['On Hold - RF', 'No Vigente', 'Sale de Plan (RF)', 'Eliminado RF', 'On Hold 5G', '', null]) {
      expect(planDeFase(fase)).toBeNull()
    }
  })

  it('da la misma clave a las distintas formas de escribir un plan', () => {
    expect(planDeFase('Rutas - Fase 1')?.clave).toBe(planDeFase('Rutas Fase 1')?.clave)
    expect(planDeFase('5G ')?.clave).toBe(planDeFase('5G')?.clave)
    expect(planDeFase('Plan 2025-2026')?.clave).toBe(planDeFase('plan 2025 2026')?.clave)
    // "Fase 1 - 5G" es un plan propio, no la Fase 1.
    expect(planDeFase('Fase 1 - 5G')?.clave).not.toBe(planDeFase('Fase 1')?.clave)
  })
})

function fila(id: string, fase: string, vigente: boolean): FilaTracker {
  return {
    sitio: { id },
    condicion: { vigente, bloqueado: false, motivoBloqueo: null, fase },
  } as unknown as FilaTracker
}

describe('filtro del plan', () => {
  const filas = [
    fila('A', 'Plan 2025-2026', true),
    fila('B', 'Plan 2025-2026', false),
    fila('C', 'Fase 1', true),
    fila('D', 'On Hold - RF', false),
    fila('E', 'Plan 2025-2026 - On Hold', false),
  ]

  it('resume los planes del archivo con sus vigentes', () => {
    const r = resumirPlanes(filas)
    expect(r.planes[0]).toMatchObject({ etiqueta: 'Plan 2025-2026', vigentes: 1, noVigentes: 2 })
    expect(r.sinPlan).toBe(1)
  })

  it('Plan 2025-2026 + Vigente deja solo esas filas', () => {
    const clave = planDeFase('Plan 2025-2026')!.clave
    const filtro = { planes: [clave], soloVigentes: true }
    expect(filas.filter((f) => filaEnPlan(f, filtro)).map((f) => f.sitio.id)).toEqual(['A'])
    const conNoVigentes = { planes: [clave], soloVigentes: false }
    expect(filas.filter((f) => filaEnPlan(f, conNoVigentes)).map((f) => f.sitio.id)).toEqual([
      'A',
      'B',
      'E',
    ])
  })

  it('sin planes elegidos entra todo', () => {
    expect(filas.every((f) => filaEnPlan(f, { planes: [], soloVigentes: true }))).toBe(true)
  })
})
