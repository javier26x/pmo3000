import { describe, expect, it } from 'vitest'
import { medirSla, slaDe, textoSla, type ConfigSla } from '.'
import { sitioProyecto } from '@/pruebas/fabricas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

const CONFIG: ConfigSla = {
  dias: { TSSR: 10, FC: 20 },
  porCelula: { 'celula-2': { FC: 30 } },
  habiles: false,
}

/** Un sitio en FC que cerro TSSR el 1 de marzo. */
function enFc(extra: Partial<SitioProyecto> = {}): SitioProyecto {
  const base = sitioProyecto({ gateActual: 'FC', ...extra })
  return {
    ...base,
    gates: { ...base.gates, TSSR: { ...base.gates.TSSR!, fechaReal: '2026-03-01' } },
  }
}

describe('slaDe', () => {
  it('la excepcion de la celula manda sobre el plazo general', () => {
    expect(slaDe(CONFIG, 'celula-1', 'FC')).toBe(20)
    expect(slaDe(CONFIG, 'celula-2', 'FC')).toBe(30)
    expect(slaDe(CONFIG, 'celula-2', 'TSSR')).toBe(10)
  })

  it('una etapa sin plazo no tiene SLA', () => {
    expect(slaDe(CONFIG, 'celula-1', 'RFI')).toBeNull()
    expect(slaDe(null, 'celula-1', 'FC')).toBeNull()
  })
})

describe('medirSla', () => {
  it('cuenta desde el cierre de la etapa anterior', () => {
    const m = medirSla(enFc(), CONFIG, '2026-03-11')
    expect(m).toMatchObject({ estado: 'en_plazo', sla: 20, transcurridos: 10, restantes: 10 })
    expect(textoSla(m)).toBe('10/20 d')
  })

  it('avisa en el tramo final y marca vencido al pasarse', () => {
    expect(medirSla(enFc(), CONFIG, '2026-03-18').estado).toBe('por_vencer')
    const vencido = medirSla(enFc(), CONFIG, '2026-03-25')
    expect(vencido.estado).toBe('vencido')
    expect(textoSla(vencido)).toBe('4 d vencido')
  })

  it('usa el plazo de la celula del sitio', () => {
    // 24 dias: vencido con el plazo general (20), dentro del de la celula (30).
    expect(medirSla(enFc({ celulaId: 'celula-2' }), CONFIG, '2026-03-25')).toMatchObject({
      sla: 30,
      restantes: 6,
    })
  })

  it('en dias habiles no cuenta fines de semana', () => {
    // Del domingo 1 al domingo 8 de marzo de 2026: 5 dias habiles.
    const m = medirSla(enFc(), { ...CONFIG, habiles: true }, '2026-03-08')
    expect(m.transcurridos).toBe(5)
  })

  it('sin fecha de entrada no inventa una medicion', () => {
    expect(medirSla(sitioProyecto({ gateActual: 'TSSR' }), CONFIG, '2026-03-11').estado).toBe(
      'sin_inicio',
    )
  })
})
