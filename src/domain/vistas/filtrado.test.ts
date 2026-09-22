import { describe, expect, it } from 'vitest'
import { sitioProyecto } from '@/pruebas/fabricas'
import {
  agruparPorGate,
  atrasoDeSeguimiento,
  estaAtrasado,
  FILTROS_VISTA_VACIOS,
  filtrarSeguimientos,
  hayFiltrosActivos,
  idsDeBusqueda,
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
    gates: { ...base.gates, TSSR: { ...base.gates.TSSR!, fechaPlan: plan } },
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
      filtrarSeguimientos(conGates, { ...FILTROS_VISTA_VACIOS, gateActual: 'TSSR' }, HOY),
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
    expect(hayFiltrosActivos({ ...FILTROS_VISTA_VACIOS, vigencia: 'todos' })).toBe(true)
  })
})

describe('vigencia', () => {
  const lista = [
    sitioProyecto({ id: 'a', sitioId: 'A-1' }),
    sitioProyecto({ id: 'b', sitioId: 'B-2', vigente: false }),
  ]

  it('por defecto esconde los no vigentes', () => {
    const r = filtrarSeguimientos(lista, FILTROS_VISTA_VACIOS, HOY)
    expect(r.map((s) => s.sitioId)).toEqual(['A-1'])
  })

  it('todos los muestra y no_vigentes muestra solo esos', () => {
    expect(
      filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, vigencia: 'todos' }, HOY),
    ).toHaveLength(2)
    const r = filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, vigencia: 'no_vigentes' }, HOY)
    expect(r.map((s) => s.sitioId)).toEqual(['B-2'])
  })
})

describe('busqueda de varios IDs', () => {
  const lista = [
    sitioProyecto({ id: '1', sitioId: '53i_379', sitioNombre: 'Uno' }),
    sitioProyecto({ id: '2', sitioId: '28i_331', sitioNombre: 'Dos' }),
    sitioProyecto({ id: '3', sitioId: '01_043', sitioNombre: 'Tres 53i_379 bis' }),
    sitioProyecto({ id: '4', sitioId: '01_0430', sitioNombre: 'Cuatro' }),
  ]

  it('reconoce una columna de IDs pegada, con cualquier separador', () => {
    expect(idsDeBusqueda('53i_379\n28i_331')).toEqual(['53i_379', '28i_331'])
    expect(idsDeBusqueda('53i_379; 28i_331,\t01_043')).toEqual(['53i_379', '28i_331', '01_043'])
    expect(idsDeBusqueda('53I_379 28i_331')).toEqual(['53i_379', '28i_331'])
  })

  it('no confunde una busqueda comun con una lista de IDs', () => {
    expect(idsDeBusqueda('53i_379')).toBeNull()
    expect(idsDeBusqueda('cerro azul')).toBeNull()
    expect(idsDeBusqueda('maipu 2')).toBeNull()
  })

  it('calza exacto, sin mayusculas, y solo por ID', () => {
    const r = filtrarSeguimientos(lista, { ...FILTROS_VISTA_VACIOS, texto: '53I_379\n01_043' }, HOY)
    // "01_0430" contiene "01_043" y "Tres 53i_379 bis" lo nombra: ninguno de los
    // dos es lo que se pego.
    expect(r.map((s) => s.sitioId).sort()).toEqual(['01_043', '53i_379'])
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
    expect(r.porGate.TSSR).toBe(2)
    expect(r.porGate.CERRADO).toBe(1)
  })

  it('agrupa por gate', () => {
    const lista = [
      sitioProyecto({ id: 'A', sitioId: 'A' }),
      sitioProyecto({ id: 'B', sitioId: 'B', gateActual: 'FC' }),
    ]
    const grupos = agruparPorGate(lista)
    expect(grupos.get('TSSR')).toHaveLength(1)
    expect(grupos.get('FC')).toHaveLength(1)
  })

  it('lista valores distintos ordenados', () => {
    expect(
      valoresDistintos([{ r: 'Maule' }, { r: 'Biobio' }, { r: 'Maule' }, { r: '' }], (x) => x.r),
    ).toEqual(['Biobio', 'Maule'])
  })
})
