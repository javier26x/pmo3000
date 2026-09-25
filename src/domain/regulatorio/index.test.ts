import { describe, expect, it } from 'vitest'
import { sitioProyecto } from '@/pruebas/fabricas'
import type { GateSitio } from '@/domain/tipos/sitioProyecto'
import {
  avanceDe,
  CARPETAS_REGULATORIAS,
  carpetasPara,
  DOCUMENTOS_REGULATORIOS,
  expedienteCompleto,
  fechaAlAire,
  ITEM_VACIO,
  modalidadDe,
  modalidadSugerida,
  type DocumentoRegulatorio,
} from './index'

function gate(extra: Partial<GateSitio>): GateSitio {
  const base = Object.values(sitioProyecto().gates)[0]!
  return { ...base, ...extra }
}

describe('fechaAlAire', () => {
  it('un seguimiento en curso no esta al aire', () => {
    expect(fechaAlAire(sitioProyecto())).toEqual({ alAire: false, fecha: null })
  })

  it('manda la etapa On Air cerrada, aunque el seguimiento no este CERRADO', () => {
    const base = sitioProyecto()
    const sp = {
      ...base,
      gates: {
        ...base.gates,
        ONAIR: gate({ nombre: 'On Air', orden: 99, estado: 'completado', fechaReal: '2026-08-10' }),
      },
    }
    expect(fechaAlAire(sp)).toEqual({ alAire: true, fecha: '2026-08-10' })
  })

  it('un CERRADO sale al aire con la ultima etapa secuencial, no con una paralela', () => {
    const sp = sitioProyecto({
      gateActual: 'CERRADO',
      gates: {
        A: gate({ orden: 0, estado: 'completado', fechaReal: '2026-05-01' }),
        B: gate({ orden: 1, estado: 'completado', fechaReal: '2026-06-01' }),
        FC: gate({ orden: 2, tipo: 'paralela', estado: 'completado', fechaReal: '2026-07-01' }),
      },
    })
    expect(fechaAlAire(sp)).toEqual({ alAire: true, fecha: '2026-06-01' })
  })
})

describe('modalidad', () => {
  it('el tracker con una columna de concurso llena lo marca de concurso', () => {
    expect(modalidadSugerida({ valores: { 'concurso-5g': 'Localidad 123' } })).toBe('concurso')
    expect(modalidadSugerida({ valores: { 'concurso-5g': 'No' } })).toBe('normal')
    expect(modalidadSugerida({ valores: { 'concurso-5g': '' } })).toBe('normal')
    expect(modalidadSugerida({ valores: { prioridad: 'Localidad' } })).toBe('normal')
  })

  it('lo que elige la persona manda sobre el tracker', () => {
    const sp = { valores: { 'concurso-5g': 'Si' } }
    expect(modalidadDe(sp, { modalidad: 'normal' })).toBe('normal')
    expect(modalidadDe(sp, { modalidad: null })).toBe('concurso')
  })

  it('la carpeta de la localidad es solo de concurso', () => {
    expect(carpetasPara('normal').map((c) => c.id)).not.toContain('carpeta-subtel')
    expect(carpetasPara('concurso').map((c) => c.id)).toContain('carpeta-subtel')
  })
})

describe('catalogo', () => {
  it('los ids son unicos: son las claves en Firestore', () => {
    const total = CARPETAS_REGULATORIAS.reduce((s, c) => s + c.documentos.length, 0)
    expect(DOCUMENTOS_REGULATORIOS.size).toBe(total)
  })
})

describe('avanceDe', () => {
  const docs: DocumentoRegulatorio[] = [
    { id: 'a', nombre: 'A', descripcion: '', condicional: false, aplica: 'ambos' },
    { id: 'b', nombre: 'B', descripcion: '', condicional: false, aplica: 'ambos' },
    { id: 'c', nombre: 'C', descripcion: '', condicional: true, aplica: 'ambos' },
  ]

  it('un condicional sin marcar no cuenta; no aplica tampoco', () => {
    const a = avanceDe(docs, {
      items: { a: { ...ITEM_VACIO, estado: 'listo' }, b: { ...ITEM_VACIO, estado: 'no_aplica' } },
    })
    expect(a).toMatchObject({ total: 1, listos: 1, porcentaje: 100, obligatoriosPendientes: 0 })
    expect(expedienteCompleto(a)).toBe(true)
  })

  it('sin expediente, todo obligatorio esta pendiente', () => {
    const a = avanceDe(docs, null)
    expect(a).toMatchObject({ total: 2, listos: 0, obligatoriosPendientes: 2 })
    expect(expedienteCompleto(a)).toBe(false)
  })

  it('un observado impide dar el expediente por completo', () => {
    const a = avanceDe(docs, {
      items: {
        a: { ...ITEM_VACIO, estado: 'listo' },
        b: { ...ITEM_VACIO, estado: 'listo' },
        c: { ...ITEM_VACIO, estado: 'observado' },
      },
    })
    expect(expedienteCompleto(a)).toBe(false)
  })
})
