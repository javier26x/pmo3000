import { describe, expect, it } from 'vitest'
import { PLANTILLA_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import type { GateTemplate } from '@/domain/tipos/gate'
import {
  analizarCambios,
  codigoParaEtapa,
  duplicarPlantilla,
  etapaNueva,
  evaluarImpacto,
  hayCambios,
  idParaItem,
  itemNuevo,
  moverEtapa,
  plantillaEnBlanco,
  prepararGuardado,
  resumirCambios,
  validarPlantilla,
} from './edicion'

const base = (): GateTemplate => structuredClone(PLANTILLA_ESTANDAR)

describe('codigoParaEtapa', () => {
  it('sale del nombre, en mayusculas y sin simbolos', () => {
    expect(codigoParaEtapa('As Built', [])).toBe('AS_BUILT')
    expect(codigoParaEtapa('Ingeniería de detalle', [])).toBe('INGENIERIA_DE_DE')
  })

  it('no choca con codigos existentes ni con CERRADO', () => {
    expect(codigoParaEtapa('FC', ['FC'])).toBe('FC_2')
    expect(codigoParaEtapa('fc', ['FC', 'FC_2'])).toBe('FC_3')
    expect(codigoParaEtapa('Cerrado', [])).toBe('CERRADO_2')
  })

  it('no empieza con digito ni queda vacio', () => {
    expect(codigoParaEtapa('7 días', [])).toBe('E_7_DIAS')
    expect(codigoParaEtapa('+++', [])).toBe('ETAPA')
  })
})

describe('idParaItem', () => {
  it('usa el codigo de la etapa y evita repetidos', () => {
    expect(idParaItem('TSSR', 'Informe firmado', [])).toBe('tssr-informe-firmado')
    expect(idParaItem('TSSR', 'Informe firmado', ['tssr-informe-firmado'])).toBe(
      'tssr-informe-firmado-2',
    )
  })
})

describe('moverEtapa', () => {
  it('intercambia y renumera el orden', () => {
    const gates = moverEtapa(base().gates, 0, 1)
    expect(gates.map((g) => g.codigo).slice(0, 2)).toEqual(['FC', 'TSSR'])
    expect(gates.map((g) => g.orden)).toEqual(gates.map((_, i) => i))
  })

  it('no se sale de los bordes', () => {
    const gates = moverEtapa(base().gates, 0, -1)
    expect(gates[0]?.codigo).toBe('TSSR')
  })
})

describe('validarPlantilla', () => {
  it('acepta la estandar y una en blanco', () => {
    expect(validarPlantilla(base())).toEqual([])
    expect(validarPlantilla(plantillaEnBlanco('plt-x', 'Nueva'))).toEqual([])
  })

  it('explica que falta', () => {
    const p = base()
    p.nombre = ' '
    p.gates[0]!.nombre = ''
    p.gates[1]!.checklist[0]!.texto = ''
    p.gates[2]!.codigo = 'TSSR'
    const errores = validarPlantilla(p)
    expect(errores.some((e) => e.includes('no tiene nombre. Escribe uno'))).toBe(true)
    expect(errores.some((e) => e.includes('La etapa 1 no tiene nombre'))).toBe(true)
    expect(errores.some((e) => e.includes('entregable 1 está vacío'))).toBe(true)
    expect(errores.some((e) => e.includes('repite el código TSSR'))).toBe(true)
  })

  it('exige al menos una etapa', () => {
    const p = base()
    p.gates = []
    expect(validarPlantilla(p)).toContain('La plantilla no tiene etapas. Agrega al menos una.')
  })
})

describe('analizarCambios y evaluarImpacto', () => {
  it('sin cambios no hay nada que avisar', () => {
    const c = analizarCambios(base(), base())
    expect(hayCambios(c)).toBe(false)
    expect(evaluarImpacto(c, 100)).toEqual({ bloqueos: [], advertencias: [] })
  })

  it('renombrar y recolorear es solo presentacion', () => {
    const p = base()
    p.gates[0]!.nombre = 'Survey'
    p.gates[0]!.color = 'rojo'
    const c = analizarCambios(base(), p)
    expect(c.etapasPresentacion.map((e) => e.codigo)).toEqual(['TSSR'])
    expect(evaluarImpacto(c, 50)).toEqual({ bloqueos: [], advertencias: [] })
  })

  it('quitar una etapa se bloquea solo si hay seguimientos', () => {
    const p = base()
    p.gates = p.gates.filter((g) => g.codigo !== 'FC')
    const c = analizarCambios(base(), p)
    expect(c.etapasQuitadas.map((e) => e.codigo)).toEqual(['FC'])
    expect(evaluarImpacto(c, 0).bloqueos).toEqual([])
    expect(evaluarImpacto(c, 3).bloqueos).toHaveLength(1)
    expect(evaluarImpacto(c, 3).bloqueos[0]).toContain('3 sitios en seguimiento')
  })

  it('desactivar se bloquea con seguimientos; activar no', () => {
    const inactiva = { ...base(), activo: false }
    expect(evaluarImpacto(analizarCambios(base(), inactiva), 1).bloqueos).toHaveLength(1)
    expect(evaluarImpacto(analizarCambios(inactiva, base()), 1).bloqueos).toEqual([])
  })

  it('agregar, reordenar y exigir entregables se advierte', () => {
    const p = base()
    p.gates = moverEtapa(p.gates, 0, 1)
    p.gates = [...p.gates, etapaNueva('As Built', p.gates)]
    const fc = p.gates.find((g) => g.codigo === 'FC')!
    fc.checklist = [...fc.checklist, itemNuevo(fc, 'Acta de entrega')]
    fc.slaDias += 5
    const c = analizarCambios(base(), p)
    expect(c.reordenada).toBe(true)
    expect(c.etapasNuevas.map((e) => e.codigo)).toEqual(['AS_BUILT'])
    expect(c.obligatoriosNuevos).toHaveLength(1)
    expect(c.sla.map((e) => e.codigo)).toEqual(['FC'])
    const impacto = evaluarImpacto(c, 1)
    expect(impacto.bloqueos).toEqual([])
    expect(impacto.advertencias).toHaveLength(4)
    expect(impacto.advertencias.join(' ')).toContain('1 sitio en seguimiento')
  })

  it('agregar una etapa al final no cuenta como reordenar', () => {
    const p = base()
    p.gates = [...p.gates, etapaNueva('Extra', p.gates)]
    expect(analizarCambios(base(), p).reordenada).toBe(false)
  })

  it('resume los cambios para la auditoria', () => {
    const p = base()
    p.nombre = 'Otra'
    p.gates[0]!.nombre = 'Survey'
    expect(resumirCambios(analizarCambios(base(), p))).toEqual([
      'Nombre de la plantilla',
      'Nombre, descripción o color: «Survey»',
    ])
  })
})

describe('prepararGuardado', () => {
  it('sube la version solo si algo cambio', () => {
    const original = base()
    expect(prepararGuardado(original, base()).version).toBe(original.version)
    const p = base()
    p.nombre = '  Otra  '
    const lista = prepararGuardado(original, p)
    expect(lista.version).toBe(original.version + 1)
    expect(lista.nombre).toBe('Otra')
  })

  it('renumera el orden y arranca en 1 si es nueva', () => {
    const p = base()
    p.gates = [...p.gates].reverse()
    const lista = prepararGuardado(null, { ...p, version: 7 })
    expect(lista.version).toBe(1)
    expect(lista.gates.map((g) => g.orden)).toEqual(lista.gates.map((_, i) => i))
  })
})

describe('duplicarPlantilla', () => {
  it('copia las etapas con otro id y version 1, sin compartir referencias', () => {
    const original = { ...base(), version: 4 }
    const copia = duplicarPlantilla(original, 'plt-copia', 'Copia')
    expect(copia).toMatchObject({ id: 'plt-copia', nombre: 'Copia', version: 1, activo: true })
    copia.gates[0]!.nombre = 'Cambiada'
    expect(original.gates[0]!.nombre).not.toBe('Cambiada')
  })
})
