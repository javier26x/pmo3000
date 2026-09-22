import { describe, expect, it } from 'vitest'
import { actor, cumplirChecklist, plantilla, sitioProyecto } from '@/pruebas/fabricas'
import {
  contextoDe,
  crearGatesDesdePlantilla,
  evaluarAvance,
  evaluarMovimiento,
  itemsFaltantes,
  planAvanzarGate,
  planBloqueo,
  planMarcarChecklist,
  planRetrocederGate,
  porcentajeAvance,
} from './maquina'
import { gateDePlantilla } from '@/domain/tipos/gate'
import { secuenciaDeGates } from './catalogo'

const AHORA = new Date('2026-02-01T15:00:00Z')
const ctx = (rol: Parameters<typeof actor>[0]) => contextoDe(actor(rol), AHORA)

describe('crearGatesDesdePlantilla con etapas paralelas', () => {
  // Una paralela al principio: el sitio no debe arrancar en ella ni la cadena
  // de `siguiente` debe pasar por ella.
  const conParalela = {
    ...plantilla,
    gates: [
      {
        ...plantilla.gates[0]!,
        codigo: 'FC_PAR',
        nombre: 'FC',
        orden: 0,
        tipo: 'paralela' as const,
      },
      ...plantilla.gates.map((g) => ({ ...g, orden: g.orden + 1 })),
    ],
  }
  const r = crearGatesDesdePlantilla(conParalela, {
    fechaInicio: '2026-01-01',
    responsableUid: null,
    proveedorId: null,
  })

  it('arranca en la primera secuencial y la paralela queda fuera de la cadena', () => {
    const primera = plantilla.gates[0]!.codigo
    expect(r.gateActual).toBe(primera)
    expect(r.gates.FC_PAR?.tipo).toBe('paralela')
    expect(r.gates.FC_PAR?.siguiente).toBeNull()
    expect(r.gates.FC_PAR?.fechaPlan).toBeNull()
    expect(r.gates[primera]?.siguiente).toBe(plantilla.gates[1]!.codigo)
    expect(secuenciaDeGates(r.gates)).not.toContain('FC_PAR')
    expect(secuenciaDeGates(r.gates)).toHaveLength(plantilla.gates.length)
  })
})

describe('crearGatesDesdePlantilla', () => {
  it('abre el primer gate y deja el resto sin iniciar', () => {
    const r = crearGatesDesdePlantilla(plantilla, {
      fechaInicio: '2026-01-01',
      responsableUid: 'uid-1',
      proveedorId: 'prov-alfa',
    })
    expect(r.gateActual).toBe('TSSR')
    expect(r.gates.TSSR?.estado).toBe('en_curso')
    expect(r.gates.FC?.estado).toBe('no_iniciado')
    expect(Object.keys(r.gates)).toHaveLength(7)
  })

  it('encadena las fechas plan sumando el SLA de cada gate', () => {
    const r = crearGatesDesdePlantilla(plantilla, {
      fechaInicio: '2026-01-01',
      responsableUid: null,
      proveedorId: null,
    })
    expect(r.gates.TSSR?.fechaPlan).toBe('2026-01-16') // +15
    expect(r.gates.FC?.fechaPlan).toBe('2026-03-02') // +45
    expect(r.fechaPlanGateActual).toBe('2026-01-16')
  })

  it('deja las fechas en null si no hay fecha de inicio', () => {
    const r = crearGatesDesdePlantilla(plantilla, {
      fechaInicio: null,
      responsableUid: null,
      proveedorId: null,
    })
    expect(r.gates.TSSR?.fechaPlan).toBeNull()
    expect(r.fechaPlanGateActual).toBeNull()
  })

  it('inicializa el checklist completo en pendiente', () => {
    const r = crearGatesDesdePlantilla(plantilla, {
      fechaInicio: null,
      responsableUid: null,
      proveedorId: null,
    })
    const definicion = gateDePlantilla(plantilla, 'TSSR')!
    expect(Object.keys(r.gates.TSSR!.checklist)).toHaveLength(definicion.checklist.length)
    expect(Object.values(r.gates.TSSR!.checklist).every((i) => !i.ok)).toBe(true)
  })
})

describe('evaluarAvance', () => {
  it('bloquea el avance con entregables obligatorios pendientes', () => {
    const r = evaluarAvance(sitioProyecto(), plantilla, actor('analista'))
    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('entregable')
    expect(r.itemsFaltantes.length).toBeGreaterThan(0)
  })

  it('permite el avance con el checklist obligatorio cumplido', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    const r = evaluarAvance(sp, plantilla, actor('analista'))
    expect(r.permitido).toBe(true)
    expect(r.destino).toBe('FC')
  })

  it('no exige los entregables opcionales', () => {
    const sp = sitioProyecto()
    const definicion = gateDePlantilla(plantilla, 'TSSR')!
    const opcional = definicion.checklist.find((i) => !i.obligatorio)!
    expect(itemsFaltantes(sp.gates.TSSR, definicion).some((i) => i.id === opcional.id)).toBe(false)
  })

  it('exige evidencia cuando el entregable la pide', () => {
    const sp = sitioProyecto()
    const definicion = gateDePlantilla(plantilla, 'TSSR')!
    const conEvidencia = definicion.checklist.find((i) => i.requiereEvidencia)!
    const gate = sp.gates.TSSR!
    const marcadoSinEvidencia = {
      ...sp,
      gates: {
        ...sp.gates,
        TSSR: {
          ...gate,
          checklist: {
            ...gate.checklist,
            [conEvidencia.id]: { ok: true, obs: '', evidenciaUrl: '', por: 'x', en: AHORA },
          },
        },
      },
    }
    expect(
      itemsFaltantes(marcadoSinEvidencia.gates.TSSR, definicion).some(
        (i) => i.id === conEvidencia.id,
      ),
    ).toBe(true)
  })

  it('rechaza el avance de un sitio bloqueado', () => {
    const sp = cumplirChecklist(
      sitioProyecto({ bloqueado: true, motivoBloqueo: 'Falta permiso municipal' }),
      'TSSR',
    )
    const r = evaluarAvance(sp, plantilla, actor('analista'))
    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('bloqueado')
  })

  it('no deja avanzar a un contratista ni a un lector', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    expect(evaluarAvance(sp, plantilla, actor('contratista')).permitido).toBe(false)
    expect(evaluarAvance(sp, plantilla, actor('lector')).permitido).toBe(false)
  })
})

describe('planAvanzarGate', () => {
  it('cierra el gate actual y abre el siguiente', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    const r = planAvanzarGate(sp, plantilla, ctx('analista'), { fechaReal: '2026-01-20' })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.valor.campos['gates.TSSR.estado']).toBe('completado')
    expect(r.valor.campos['gates.TSSR.fechaReal']).toBe('2026-01-20')
    expect(r.valor.campos.gateActual).toBe('FC')
    expect(r.valor.campos['gates.FC.estado']).toBe('en_curso')
    expect(r.valor.campos.fechaPlanGateActual).toBe(sp.gates.FC?.fechaPlan)
  })

  it('deja rastro de auditoria del cambio de gate', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    const r = planAvanzarGate(sp, plantilla, ctx('analista'), { fechaReal: '2026-01-20' })
    if (!r.ok) throw new Error('deberia permitir el avance')

    const evento = r.valor.eventos.find((e) => e.accion === 'cambio_gate')
    expect(evento).toBeDefined()
    expect(evento?.valorAnterior).toBe('TSSR')
    expect(evento?.valorNuevo).toBe('FC')
    expect(evento?.entidadId).toBe(sp.id)
    expect(evento?.sitioId).toBe(sp.sitioId)
  })

  it('rechaza una fecha real en el futuro', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    const r = planAvanzarGate(sp, plantilla, ctx('analista'), { fechaReal: '2026-12-01' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('futuro')
  })

  it('rechaza una fecha real anterior al cierre del gate previo', () => {
    let sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    sp = {
      ...sp,
      gateActual: 'FC',
      gates: {
        ...sp.gates,
        TSSR: { ...sp.gates.TSSR!, estado: 'completado', fechaReal: '2026-01-20' },
        FC: { ...sp.gates.FC!, estado: 'en_curso' },
      },
    }
    sp = cumplirChecklist(sp, 'FC')
    const r = planAvanzarGate(sp, plantilla, ctx('analista'), { fechaReal: '2026-01-10' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('anterior al cierre')
  })

  it('cierra el sitio al completar el ultimo gate', () => {
    let sp = sitioProyecto({ gateActual: 'SSV' })
    sp = cumplirChecklist(sp, 'SSV')
    const r = planAvanzarGate(sp, plantilla, ctx('analista'), { fechaReal: '2026-01-20' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.campos.gateActual).toBe('CERRADO')
    expect(r.valor.campos.estadoGate).toBe('completado')
    expect(r.valor.campos.fechaPlanGateActual).toBeNull()
  })
})

describe('evaluarMovimiento (kanban)', () => {
  it('acepta mover al gate siguiente si el checklist esta cumplido', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    expect(evaluarMovimiento(sp, plantilla, actor('analista'), 'FC')).toMatchObject({
      permitido: true,
      tipo: 'avance',
    })
  })

  it('rechaza saltarse gates', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    const r = evaluarMovimiento(sp, plantilla, actor('analista'), 'SSV')
    expect(r.permitido).toBe(false)
    expect(r.motivo).toContain('secuenciales')
  })

  it('permite retroceder solo a jefe y admin', () => {
    const sp = sitioProyecto({ gateActual: 'FC' })
    expect(evaluarMovimiento(sp, plantilla, actor('jefe_celula'), 'TSSR').permitido).toBe(true)
    expect(evaluarMovimiento(sp, plantilla, actor('admin'), 'TSSR').permitido).toBe(true)
    expect(evaluarMovimiento(sp, plantilla, actor('analista'), 'TSSR').permitido).toBe(false)
  })

  it('rechaza mover al mismo gate', () => {
    const sp = sitioProyecto()
    expect(evaluarMovimiento(sp, plantilla, actor('admin'), 'TSSR').permitido).toBe(false)
  })
})

describe('planRetrocederGate', () => {
  it('exige motivo', () => {
    const sp = sitioProyecto({ gateActual: 'FC' })
    expect(planRetrocederGate(sp, plantilla, ctx('admin'), '  ').ok).toBe(false)
  })

  it('reabre el gate anterior y limpia su fecha real', () => {
    const sp = sitioProyecto({ gateActual: 'FC' })
    const r = planRetrocederGate(sp, plantilla, ctx('admin'), 'Acta rechazada por calidad')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.campos.gateActual).toBe('TSSR')
    expect(r.valor.campos['gates.TSSR.fechaReal']).toBeNull()
    expect(r.valor.campos['gates.FC.estado']).toBe('no_iniciado')
    expect(r.valor.eventos[0]?.accion).toBe('retroceso_gate')
    expect(r.valor.eventos[0]?.detalle).toBe('Acta rechazada por calidad')
  })
})

describe('planMarcarChecklist', () => {
  it('el contratista puede marcar entregables de sus sitios', () => {
    const sp = sitioProyecto({ proveedorId: 'prov-alfa' })
    const r = planMarcarChecklist(sp, plantilla, ctx('contratista'), {
      codigo: 'TSSR',
      itemId: 'tssr-coordenadas',
      ok: true,
    })
    expect(r.ok).toBe(true)
  })

  it('el contratista no puede marcar entregables de otra empresa', () => {
    const sp = sitioProyecto({ proveedorId: 'prov-beta' })
    const r = planMarcarChecklist(sp, plantilla, ctx('contratista'), {
      codigo: 'TSSR',
      itemId: 'tssr-coordenadas',
      ok: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('tu empresa')
  })

  it('el lector no puede marcar nada', () => {
    const r = planMarcarChecklist(sitioProyecto(), plantilla, ctx('lector'), {
      codigo: 'TSSR',
      itemId: 'tssr-coordenadas',
      ok: true,
    })
    expect(r.ok).toBe(false)
  })

  it('exige evidencia cuando el entregable la pide', () => {
    const r = planMarcarChecklist(sitioProyecto(), plantilla, ctx('analista'), {
      codigo: 'TSSR',
      itemId: 'tssr-informe',
      ok: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('evidencia')
  })

  it('rechaza marcar el checklist de un gate futuro', () => {
    const r = planMarcarChecklist(sitioProyecto(), plantilla, ctx('analista'), {
      codigo: 'SSV',
      itemId: 'ssv-carpeta',
      ok: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('gate futuro')
  })

  it('registra quien marco el entregable', () => {
    const r = planMarcarChecklist(sitioProyecto(), plantilla, ctx('analista'), {
      codigo: 'TSSR',
      itemId: 'tssr-coordenadas',
      ok: true,
      obs: 'Validado con GPS diferencial',
    })
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos['gates.TSSR.checklist.tssr-coordenadas.por']).toBe('uid-analista')
    expect(r.valor.campos['gates.TSSR.checklist.tssr-coordenadas.en']).toEqual(AHORA)
    expect(r.valor.eventos[0]?.detalle).toBe('Validado con GPS diferencial')
  })
})

describe('planBloqueo', () => {
  it('exige motivo al bloquear', () => {
    expect(planBloqueo(sitioProyecto(), ctx('analista'), { bloqueado: true, motivo: '' }).ok).toBe(
      false,
    )
  })

  it('limpia el motivo al desbloquear', () => {
    const sp = sitioProyecto({ bloqueado: true, motivoBloqueo: 'Sin energia' })
    const r = planBloqueo(sp, ctx('analista'), { bloqueado: false, motivo: '' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.campos.motivoBloqueo).toBeNull()
    expect(r.valor.campos.estadoGate).toBe('en_curso')
  })
})

describe('porcentajeAvance', () => {
  it('es 0 en un sitio recien creado', () => {
    expect(porcentajeAvance(sitioProyecto(), plantilla)).toBe(0)
  })

  it('es 100 cuando el sitio esta cerrado', () => {
    expect(porcentajeAvance(sitioProyecto({ gateActual: 'CERRADO' }), plantilla)).toBe(100)
  })

  it('da credito parcial por el checklist del gate en curso', () => {
    const sp = cumplirChecklist(sitioProyecto(), 'TSSR')
    // 0 gates cerrados de 7, pero el checklist del actual esta completo: 1/7.
    expect(porcentajeAvance(sp, plantilla)).toBe(14)
  })

  it('crece al avanzar de gate', () => {
    const enD1 = sitioProyecto({ gateActual: 'D1' })
    expect(porcentajeAvance(enD1, plantilla)).toBe(57)
  })
})
