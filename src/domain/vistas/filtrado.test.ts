import { describe, expect, it } from 'vitest'
import { sitioProyecto } from '@/pruebas/fabricas'
import {
  agruparPorGate,
  atrasoDeSeguimiento,
  estaAtrasado,
  FILTROS_VISTA_VACIOS,
  filtrarSeguimientos,
  hayFiltrosActivos,
  ordenarSeguimientos,
  resumirSeguimientos,
  valoresDistintos,
} from './filtrado'

const HOY = '2026-06-01'

const conPlan = (id: string, plan: string | null, extra = {}) => {
  const base = sitioProyecto({ id, sitioId: id, ...extra })
  return {
    ...base,
    fechaPlanGateActual: plan,
    gates: { ...base.gates, TCSR: { ...base.gates.TCSR!, fechaPlan: plan } },
  }
}

describe('atraso del seguimiento', () => {
  it('mide contra el gate en curso', () => {
    expect(atrasoDeSeguimiento(conPlan('A', '2026-05-01'), HOY)).toBe(31)
    expect(atrasoDeSeguimiento(conPlan('B', '2026-07-01'), HOY)).toBe(-30)
  })

  it('un sitio cerrado no esta atrasado', () => {
    const cerrado = sitioProyecto({ gateActual: 'CERRADO' })
    expect(atrasoDeSeguimiento(cerrado, HOY)).toBeNull()
    expect(estaAtrasado(cerrado, HOY)).toBe(false)
  })

  it('sin fecha plan no hay atraso', () => {
    expect(atrasoDeSeguimiento(conPlan('C', null), HOY)).toBeNull()
  })
})

describe('filtrarSeguimientos', () => {
  const lista = [
    conPlan('RM-0001', '2026-05-01', {
      sitioNombre: 'Cerro Azul 1',
      region: 'Metropolitana',
      comuna: 'Maipu',
    }),
    conPlan('VAL-0002', '2026-07-01', {
      sitioNombre: 'Loma Verde 2',
      region: 'Valparaiso',
      comuna: 'Quilpue',
      prioridad: 'alta' as const,
    }),
    conPlan('BIO-0003', '2026-04-01', {
      sitioNombre: 'Vega Sur 3',
      region: 'Biobio',
      comuna: 'Coronel',
      bloqueado: true,
    }),
  ]

  it('sin filtros devuelve todo', () => {
    expect(filtrarSeguimientos(lista, FILTROS_VISTA_VACIOS, HOY)).toHaveLength(3)
  })

  it('busca por ID, nombre y comuna, ignorando acentos', () => {
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, texto: 'val-0002' }, HOY),
    ).toHaveLength(1)
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, texto: 'loma' }, HOY),
    ).toHaveLength(1)
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, texto: 'MAIPÚ' }, HOY),
    ).toHaveLength(1)
  })

  it('filtra por gate en el cliente', () => {
    const conGates = [
      conPlan('A', '2026-05-01'),
      { ...conPlan('B', '2026-05-01'), gateActual: 'FC' as const },
    ]
    expect(
      filtrarSeguimientos(conGates, { ...FILTROS_VISTA_VACIOS, gateActual: 'FC' }, HOY),
    ).toHaveLength(1)
    expect(
      filtrarSeguimientos(conGates, { ...FILTROS_VISTA_VACIOS, gateActual: 'TCSR' }, HOY),
    ).toHaveLength(1)
  })

  it('filtra por region y prioridad', () => {
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, region: 'Biobio' }, HOY),
    ).toHaveLength(1)
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, prioridad: 'alta' }, HOY),
    ).toHaveLength(1)
  })

  it('filtra atrasados y bloqueados', () => {
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, soloAtrasados: true }, HOY),
    ).toHaveLength(2)
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, soloBloqueados: true }, HOY),
    ).toHaveLength(1)
  })

  it('combina filtros con AND', () => {
    const r = filtrarSeguimientos(
      lista,
      { ...FILTROS_VISTA_VACIOS, soloAtrasados: true, region: 'Biobio' },
      HOY,
    )
    expect(r).toHaveLength(1)
    expect(r[0]?.sitioId).toBe('BIO-0003')
  })

  it('detecta si hay filtros activos', () => {
    expect(hayFiltrosActivos(FILTROS_VISTA_VACIOS)).toBe(false)
    expect(hayFiltrosActivos({ ...FILTROS_VISTA_VACIOS, texto: ' ' })).toBe(false)
    expect(hayFiltrosActivos({ ...FILTROS_VISTA_VACIOS, soloAtrasados: true })).toBe(true)
  })
})

describe('ordenarSeguimientos', () => {
  const lista = [conPlan('B', '2026-05-01'), conPlan('A', '2026-07-01'), conPlan('C', null)]

  it('ordena por ID de sitio', () => {
    expect(ordenarSeguimientos(lista, 'sitio', 'asc', HOY).map((s) => s.sitioId)).toEqual([
      'A',
      'B',
      'C',
    ])
    expect(ordenarSeguimientos(lista, 'sitio', 'desc', HOY).map((s) => s.sitioId)).toEqual([
      'C',
      'B',
      'A',
    ])
  })

  it('ordena por fecha plan dejando los sin fecha al final', () => {
    const r = ordenarSeguimientos(lista, 'plan', 'asc', HOY)
    expect(r.map((s) => s.sitioId)).toEqual(['B', 'A', 'C'])
  })

  it('ordena por atraso de mayor a menor', () => {
    const r = ordenarSeguimientos(lista, 'atraso', 'desc', HOY)
    expect(r[0]?.sitioId).toBe('B')
  })

  it('no muta la lista original', () => {
    const copia = [...lista]
    ordenarSeguimientos(lista, 'sitio', 'desc', HOY)
    expect(lista).toEqual(copia)
  })
})

describe('resumenes', () => {
  it('cuenta por gate, atrasados, bloqueados y cerrados', () => {
    const lista = [
      conPlan('A', '2026-05-01'),
      conPlan('B', '2026-05-01', { bloqueado: true }),
      sitioProyecto({ id: 'C', sitioId: 'C', gateActual: 'CERRADO' }),
    ]
    const r = resumirSeguimientos(lista, HOY)
    expect(r.total).toBe(3)
    expect(r.atrasados).toBe(2)
    expect(r.bloqueados).toBe(1)
    expect(r.cerrados).toBe(1)
    expect(r.porGate.TCSR).toBe(2)
    expect(r.porGate.CERRADO).toBe(1)
  })

  it('agrupa por gate', () => {
    const lista = [
      sitioProyecto({ id: 'A', sitioId: 'A' }),
      sitioProyecto({ id: 'B', sitioId: 'B', gateActual: 'FC' }),
    ]
    const grupos = agruparPorGate(lista)
    expect(grupos.get('TCSR')).toHaveLength(1)
    expect(grupos.get('FC')).toHaveLength(1)
  })

  it('lista valores distintos ordenados', () => {
    expect(
      valoresDistintos([{ r: 'Maule' }, { r: 'Biobio' }, { r: 'Maule' }, { r: '' }], (x) => x.r),
    ).toEqual(['Biobio', 'Maule'])
  })
})
