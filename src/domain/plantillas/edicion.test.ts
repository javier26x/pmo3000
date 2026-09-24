import { describe, expect, it } from 'vitest'
import { PLANTILLA_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import type { GateTemplate } from '@/domain/tipos/gate'
import {
  analizarCambios,
  cambiarCarril,
  codigoParaEtapa,
  codigosDefinitivos,
  duplicarPlantilla,
  etapaNueva,
  evaluarImpacto,
  hayCambios,
  etapasDelCarril,
  idParaItem,
  insertarEnCarril,
  itemNuevo,
  moverEnCarril,
  moverEtapa,
  pendientesDeEtapa,
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

describe('carriles', () => {
  // TSSR, FC(paralela), ING, AB: una importada puede traerlas intercaladas.
  const intercalada = () => {
    const [a, b, c, d] = base().gates
    return [a!, { ...b!, tipo: 'paralela' as const }, c!, d!]
  }
  const codigos = (gates: { codigo: string }[]) => gates.map((g) => g.codigo)

  it('mover dentro del recorrido no toca la posicion de las paralelas', () => {
    const gates = intercalada()
    const [a, b, c, d] = codigos(gates)
    const movidas = moverEnCarril(gates, 'secuencial', 0, 2)
    expect(codigos(movidas)).toEqual([c, b, d, a])
    expect(movidas.map((g) => g.orden)).toEqual([0, 1, 2, 3])
    expect(analizarCambios({ ...base(), gates }, { ...base(), gates: movidas }).reordenada).toBe(
      true,
    )
  })

  it('insertar en medio del recorrido deja la etapa en ese lugar', () => {
    const gates = intercalada()
    const nueva = etapaNueva('Permisos', gates)
    const con = insertarEnCarril(gates, nueva, 1)
    expect(codigos(etapasDelCarril(con, 'secuencial'))).toEqual([
      gates[0]!.codigo,
      nueva.codigo,
      gates[2]!.codigo,
      gates[3]!.codigo,
    ])
    expect(con[1]?.codigo).toBe(gates[1]!.codigo)
  })

  it('una paralela nueva va al final de su carril', () => {
    const gates = intercalada()
    const nueva = { ...etapaNueva('Contrato', gates), tipo: 'paralela' as const }
    const con = insertarEnCarril(gates, nueva, 99)
    expect(codigos(etapasDelCarril(con, 'paralela'))).toEqual([gates[1]!.codigo, nueva.codigo])
  })

  it('cambiar de carril la manda al final del otro', () => {
    const gates = intercalada()
    const primera = gates[0]!.codigo
    const cambiadas = cambiarCarril(gates, primera, 'paralela')
    expect(codigos(etapasDelCarril(cambiadas, 'paralela')).at(-1)).toBe(primera)
    expect(cambiadas.find((g) => g.codigo === primera)?.tipo).toBe('paralela')
  })

  it('no deja una plantilla sin recorrido principal', () => {
    const p = base()
    p.gates = p.gates.map((g) => ({ ...g, tipo: 'paralela' as const }))
    expect(validarPlantilla(p).join(' ')).toMatch(/recorrido principal/)
  })

  it('las etapas nuevas toman el codigo de su nombre final; las guardadas no cambian', () => {
    const gates = base().gates
    const reservados = new Set(gates.map((g) => g.codigo))
    const nueva = { ...etapaNueva('Etapa nueva', gates), nombre: 'Permisos DOM' }
    const repetida = { ...etapaNueva('Etapa nueva', [...gates, nueva]), nombre: gates[0]!.nombre }
    const finales = codigosDefinitivos([...gates, nueva, repetida], reservados)
    expect(finales.slice(0, gates.length)).toEqual(gates)
    expect(finales.at(-2)?.codigo).toBe('PERMISOS_DOM')
    expect(finales.at(-1)?.codigo).toBe(`${gates[0]!.codigo}_2`)
  })

  it('marca lo que le falta a una etapa', () => {
    const g = { ...base().gates[0]!, nombre: ' ', slaDias: -1 }
    expect(pendientesDeEtapa(g)).toEqual(['Falta el nombre', 'Revisa los días'])
    expect(pendientesDeEtapa(base().gates[0]!)).toEqual([])
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
