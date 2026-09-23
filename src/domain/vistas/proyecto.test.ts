import { describe, expect, it } from 'vitest'
import { sitioProyecto } from '@/pruebas/fabricas'
import { resumirProyecto } from './proyecto'

describe('resumirProyecto', () => {
  const seguimientos = [
    sitioProyecto({ id: 'a', proyectoId: 'p1', gateActual: 'ING', ordenGateActual: 2 }),
    sitioProyecto({ id: 'b', proyectoId: 'p1', gateActual: 'TSS', ordenGateActual: 1 }),
    sitioProyecto({
      id: 'c',
      proyectoId: 'p1',
      gateActual: 'TSS',
      ordenGateActual: 1,
      bloqueado: true,
    }),
    sitioProyecto({ id: 'd', proyectoId: 'p1', gateActual: 'CERRADO', ordenGateActual: null }),
    sitioProyecto({ id: 'e', proyectoId: 'p1', gateActual: 'TSS', vigente: false }),
    sitioProyecto({ id: 'f', proyectoId: 'otro', gateActual: 'TSS' }),
  ]
  const r = resumirProyecto(seguimientos, 'p1', (sp) =>
    sp.id === 'a' ? 'vencido' : sp.id === 'b' ? 'por_vencer' : 'en_plazo',
  )

  it('cuenta solo los sitios del proyecto', () => {
    expect(r).toMatchObject({ total: 5, vigentes: 4, noVigentes: 1, bloqueados: 1, cerrados: 1 })
  })

  it('reparte los vigentes abiertos por etapa, en el orden del proceso', () => {
    expect(r.porEtapa).toEqual([
      { codigo: 'TSS', total: 2 },
      { codigo: 'ING', total: 1 },
    ])
  })

  it('el SLA se mide solo sobre vigentes abiertos', () => {
    expect(r).toMatchObject({ fueraDeSla: 1, porVencer: 1 })
  })
})
