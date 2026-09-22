import { describe, expect, it } from 'vitest'
import { actor, sitioProyecto } from '@/pruebas/fabricas'
import {
  contextoDe,
  planCambiarCelula,
  planCorreccionAdmin,
  puedeCorregirComoAdmin,
  validarEliminacion,
} from './maquina'
import { CERRADO } from './catalogo'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

const AHORA = new Date('2026-02-01T15:00:00Z')
const ctx = (rol: Parameters<typeof actor>[0]) => contextoDe(actor(rol), AHORA)

/** Aplica los campos con notacion de punto sobre una copia, como haria Firestore. */
function aplicar(sp: SitioProyecto, campos: Record<string, unknown>): SitioProyecto {
  const copia = structuredClone(sp) as unknown as Record<string, unknown>
  for (const [clave, valor] of Object.entries(campos)) {
    const partes = clave.split('.')
    let nodo = copia
    for (const p of partes.slice(0, -1)) nodo = nodo[p] as Record<string, unknown>
    nodo[partes[partes.length - 1]!] = valor
  }
  return copia as unknown as SitioProyecto
}

describe('planCorreccionAdmin', () => {
  const opciones = { destino: 'D1', fechaReal: '2026-01-20', motivo: 'Tracker desfasado' }

  it('solo el admin puede', () => {
    for (const rol of ['jefe_celula', 'analista', 'contratista', 'lector'] as const) {
      expect(planCorreccionAdmin(sitioProyecto(), ctx(rol), opciones).ok).toBe(false)
      expect(puedeCorregirComoAdmin({ rol })).toBe(false)
    }
    expect(puedeCorregirComoAdmin({ rol: 'admin' })).toBe(true)
  })

  it('exige motivo', () => {
    const r = planCorreccionAdmin(sitioProyecto(), ctx('admin'), { ...opciones, motivo: '  ' })
    expect(r.ok).toBe(false)
  })

  it('rechaza una etapa que el sitio no tiene y una fecha futura', () => {
    expect(
      planCorreccionAdmin(sitioProyecto(), ctx('admin'), { ...opciones, destino: 'NOPE' }).ok,
    ).toBe(false)
    expect(
      planCorreccionAdmin(sitioProyecto(), ctx('admin'), { ...opciones, fechaReal: '2026-12-01' })
        .ok,
    ).toBe(false)
  })

  it('salta hacia adelante cerrando todo lo anterior de forma coherente', () => {
    const sp = sitioProyecto()
    const r = planCorreccionAdmin(sp, ctx('admin'), opciones)
    if (!r.ok) throw new Error(r.motivo)
    const nuevo = aplicar(sp, r.valor.campos)

    expect(nuevo.gateActual).toBe('D1')
    expect(nuevo.estadoGate).toBe('en_curso')
    for (const c of ['TSSR', 'FC', 'RFI', 'IMP']) {
      expect(nuevo.gates[c]?.estado).toBe('completado')
      expect(nuevo.gates[c]?.fechaReal).toBe('2026-01-20')
      expect(nuevo.gates[c]?.completadoPor).toBe(actor('admin').uid)
    }
    expect(nuevo.gates.D1?.estado).toBe('en_curso')
    expect(nuevo.gates.D7?.estado).toBe('no_iniciado')
    expect(nuevo.fechaPlanGateActual).toBe(sp.gates.D1?.fechaPlan)

    const [evento] = r.valor.eventos
    expect(evento?.accion).toBe('cambio_gate')
    expect(evento?.valorAnterior).toBe('TSSR')
    expect(evento?.valorNuevo).toBe('D1')
    expect(evento?.detalle).toContain('Tracker desfasado')
  })

  it('respeta la fecha real que un gate cerrado ya tenia', () => {
    const base = sitioProyecto()
    base.gates.TSSR = { ...base.gates.TSSR!, estado: 'completado', fechaReal: '2026-01-05' }
    const r = planCorreccionAdmin(base, ctx('admin'), { ...opciones, destino: 'RFI' })
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos['gates.TSSR.fechaReal']).toBeUndefined()
    expect(r.valor.campos['gates.FC.fechaReal']).toBe('2026-01-20')
  })

  it('salta hacia atras reabriendo y limpiando los posteriores', () => {
    const sp = sitioProyecto()
    const adelante = planCorreccionAdmin(sp, ctx('admin'), { ...opciones, destino: CERRADO })
    if (!adelante.ok) throw new Error(adelante.motivo)
    const cerrado = aplicar(sp, adelante.valor.campos)
    expect(cerrado.gateActual).toBe(CERRADO)
    expect(cerrado.estadoGate).toBe('completado')
    expect(cerrado.fechaPlanGateActual).toBeNull()
    expect(Object.values(cerrado.gates).every((g) => g?.estado === 'completado')).toBe(true)

    const r = planCorreccionAdmin(cerrado, ctx('admin'), { ...opciones, destino: 'FC' })
    if (!r.ok) throw new Error(r.motivo)
    const nuevo = aplicar(cerrado, r.valor.campos)
    expect(nuevo.gateActual).toBe('FC')
    expect(nuevo.gates.TSSR?.estado).toBe('completado')
    expect(nuevo.gates.FC?.estado).toBe('en_curso')
    expect(nuevo.gates.FC?.fechaReal).toBeNull()
    expect(nuevo.gates.SSV?.estado).toBe('no_iniciado')
    expect(nuevo.gates.SSV?.fechaReal).toBeNull()
    expect(nuevo.gates.SSV?.completadoPor).toBeNull()
    expect(r.valor.eventos[0]?.accion).toBe('retroceso_gate')
  })

  it('en el mismo gate repara estados incoherentes, y si no hay nada que hacer lo dice', () => {
    const sp = sitioProyecto()
    expect(planCorreccionAdmin(sp, ctx('admin'), { ...opciones, destino: 'TSSR' }).ok).toBe(false)

    sp.gates.RFI = { ...sp.gates.RFI!, estado: 'completado', fechaReal: '2026-01-10' }
    const r = planCorreccionAdmin(sp, ctx('admin'), { ...opciones, destino: 'TSSR' })
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos['gates.RFI.estado']).toBe('no_iniciado')
    expect(r.valor.campos['gates.RFI.fechaReal']).toBeNull()
    expect(r.valor.eventos[0]?.accion).toBe('actualizar')
  })

  it('un sitio bloqueado sigue bloqueado', () => {
    const sp = sitioProyecto({ bloqueado: true, motivoBloqueo: 'x', estadoGate: 'bloqueado' })
    const r = planCorreccionAdmin(sp, ctx('admin'), opciones)
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos.estadoGate).toBeUndefined()
  })
})

describe('planCambiarCelula', () => {
  it('solo admin, y registra el cambio', () => {
    const sp = sitioProyecto()
    expect(planCambiarCelula(sp, ctx('jefe_celula'), { celulaId: 'otra' }).ok).toBe(false)
    expect(planCambiarCelula(sp, ctx('admin'), { celulaId: sp.celulaId }).ok).toBe(false)
    const r = planCambiarCelula(sp, ctx('admin'), { celulaId: 'otra' })
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos).toEqual({ celulaId: 'otra' })
    expect(r.valor.eventos[0]?.valorAnterior).toBe(sp.celulaId)
  })

  it('permite dejarlo sin celula', () => {
    const r = planCambiarCelula(sitioProyecto(), ctx('admin'), { celulaId: '' })
    if (!r.ok) throw new Error(r.motivo)
    expect(r.valor.campos).toEqual({ celulaId: null })
  })
})

describe('validarEliminacion', () => {
  const sp = { sitioId: 'SITIO-0001' }
  const admin = { rol: 'admin' as const }

  it('exige admin, motivo y el id escrito tal cual', () => {
    expect(
      validarEliminacion(sp, { rol: 'jefe_celula' }, { confirmacion: 'SITIO-0001', motivo: 'x' })
        .ok,
    ).toBe(false)
    expect(validarEliminacion(sp, admin, { confirmacion: 'SITIO-0001', motivo: '' }).ok).toBe(false)
    expect(validarEliminacion(sp, admin, { confirmacion: 'sitio-0001', motivo: 'x' }).ok).toBe(
      false,
    )
    expect(validarEliminacion(sp, admin, { confirmacion: ' SITIO-0001 ', motivo: 'x' }).ok).toBe(
      true,
    )
  })
})
