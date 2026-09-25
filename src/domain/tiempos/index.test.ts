import { describe, expect, it } from 'vitest'
import { estadistica, resumirTiempos, textoDias, tiemposDelSitio } from '.'
import { sitioProyecto } from '@/pruebas/fabricas'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { GateSitio, RevisionSitio, SitioProyecto } from '@/domain/tipos/sitioProyecto'

const PLANTILLA: GateTemplate = {
  id: 'tpl-tracker',
  nombre: 'Tracker',
  descripcion: '',
  version: 1,
  activo: true,
  campos: [],
  homologacion: {},
  gates: [
    {
      codigo: 'SA',
      nombre: 'SA',
      descripcion: '',
      color: 'gris',
      orden: 0,
      slaDias: 0,
      checklist: [],
      revisiones: [],
      tipo: 'secuencial',
    },
    {
      codigo: 'TSS',
      nombre: 'TSS',
      descripcion: '',
      color: 'gris',
      orden: 1,
      slaDias: 0,
      checklist: [],
      revisiones: [
        { id: 'rf', nombre: 'RF', bloquea: true },
        { id: 'oocc', nombre: 'OOCC', bloquea: true },
        { id: 'mmoo', nombre: 'MMOO', bloquea: true },
      ],
      tipo: 'secuencial',
    },
    {
      codigo: 'ING',
      nombre: 'Ingeniería',
      descripcion: '',
      color: 'gris',
      orden: 2,
      slaDias: 0,
      checklist: [],
      revisiones: [{ id: 'rf', nombre: 'RF', bloquea: true }],
      tipo: 'secuencial',
    },
  ],
  creadoEn: new Date(),
  creadoPor: 'x',
  actualizadoEn: new Date(),
  actualizadoPor: 'x',
}

function rev(estado: string, fecha: string | null): RevisionSitio {
  return { estado, comentario: '', fecha, por: null, en: null }
}

function gate(orden: number, extra: Partial<GateSitio>): GateSitio {
  return {
    orden,
    nombre: '',
    color: 'gris',
    siguiente: null,
    tipo: 'secuencial',
    estado: 'no_iniciado',
    fechaPlan: null,
    fechaReal: null,
    fechaBaseline: null,
    responsableUid: null,
    proveedorId: null,
    checklist: {},
    revisiones: {},
    completadoEn: null,
    completadoPor: null,
    ...extra,
  }
}

/** SA cerrada el 1 de marzo; TSS en curso con RF aprobado y OOCC observado. */
function enTss(extra: Partial<SitioProyecto> = {}): SitioProyecto {
  return sitioProyecto({
    gateActual: 'TSS',
    gateTemplateId: PLANTILLA.id,
    gates: {
      SA: gate(0, { nombre: 'SA', estado: 'completado', fechaReal: '2026-03-01' }),
      TSS: gate(1, {
        nombre: 'TSS',
        estado: 'en_curso',
        revisiones: {
          rf: rev('TSS Aprobado', '2026-03-05'),
          oocc: rev('TSS Observado', '2026-03-08'),
          mmoo: rev('No aplica', null),
        },
      }),
      ING: gate(2, { nombre: 'Ingeniería' }),
    },
    ...extra,
  })
}

describe('tiemposDelSitio', () => {
  it('cada validador cuenta desde el cierre de la etapa anterior', () => {
    const [sa, tss, ing] = tiemposDelSitio(enTss(), PLANTILLA, '2026-03-21')
    expect(sa).toMatchObject({ codigo: 'SA', inicio: null, dias: null })
    expect(tss).toMatchObject({ inicio: '2026-03-01', dias: 20, corriendo: true })
    const [rf, oocc, mmoo] = tss!.revisiones
    expect(rf).toMatchObject({ nombre: 'RF', estado: 'aprobado', dias: 4, corriendo: false })
    // OOCC no aprueba: su reloj sigue hasta hoy.
    expect(oocc).toMatchObject({ nombre: 'OOCC', estado: 'observado', dias: 20, corriendo: true })
    expect(mmoo).toMatchObject({ estado: 'no_aplica', dias: null, corriendo: false })
    // La etapa siguiente aun no arranca.
    expect(ing).toMatchObject({ inicio: null, dias: null, corriendo: false })
  })

  it('al cerrar el TSS arranca el reloj de la Ingenieria', () => {
    const base = enTss()
    const sp: SitioProyecto = {
      ...base,
      gateActual: 'ING',
      gates: {
        ...base.gates,
        TSS: {
          ...base.gates.TSS!,
          estado: 'completado',
          fechaReal: '2026-03-15',
          revisiones: { ...base.gates.TSS!.revisiones, oocc: rev('TSS Aprobado', '2026-03-15') },
        },
        ING: { ...base.gates.ING!, estado: 'en_curso' },
      },
    }
    const [, tss, ing] = tiemposDelSitio(sp, PLANTILLA, '2026-03-20')
    expect(tss).toMatchObject({ fin: '2026-03-15', dias: 14, corriendo: false })
    expect(tss!.revisiones.map((r) => r.dias)).toEqual([4, 14, null])
    expect(ing).toMatchObject({ inicio: '2026-03-15', dias: 5, corriendo: true })
    expect(ing!.revisiones[0]).toMatchObject({ dias: 5, corriendo: true })
  })

  it('una aprobacion fechada antes del inicio no da dias negativos', () => {
    const base = enTss()
    const sp: SitioProyecto = {
      ...base,
      gates: {
        ...base.gates,
        TSS: { ...base.gates.TSS!, revisiones: { rf: rev('Aprobado', '2026-02-20') } },
      },
    }
    const [, tss] = tiemposDelSitio(sp, PLANTILLA, '2026-03-10')
    expect(tss!.revisiones[0]!.dias).toBe(0)
  })

  it('cuenta dias habiles si el proyecto lo pide', () => {
    // 2026-03-01 es domingo: hasta el jueves 5 cuentan lunes, martes y miercoles.
    const [, tss] = tiemposDelSitio(enTss(), PLANTILLA, '2026-03-21', true)
    expect(tss!.revisiones[0]!.dias).toBe(3)
    expect(tss!.dias).toBe(15)
  })
})

describe('resumirTiempos', () => {
  it('separa lo cerrado de lo que sigue corriendo, por etapa y por validador', () => {
    const a = tiemposDelSitio(enTss(), PLANTILLA, '2026-03-21')
    const b = tiemposDelSitio(enTss(), PLANTILLA, '2026-03-11')
    const [, tss] = resumirTiempos([a, b])
    expect(tss).toMatchObject({ codigo: 'TSS', cerradas: { n: 0 }, enCurso: { n: 2, mediana: 15 } })
    const rf = tss!.revisiones.find((r) => r.id === 'rf')!
    expect(rf.cerradas).toEqual({ n: 2, mediana: 4, promedio: 4, maximo: 4 })
    const oocc = tss!.revisiones.find((r) => r.id === 'oocc')!
    expect(oocc.enCurso).toMatchObject({ n: 2, mediana: 15, maximo: 20 })
  })
})

describe('estadistica y textoDias', () => {
  it('mediana par e impar', () => {
    expect(estadistica([5, 1, 3]).mediana).toBe(3)
    expect(estadistica([1, 2, 3, 10]).mediana).toBe(2.5)
    expect(estadistica([])).toEqual({ n: 0, mediana: null, promedio: null, maximo: null })
  })

  it('formatea con coma decimal', () => {
    expect(textoDias(2.5)).toBe('2,5 d')
    expect(textoDias(12)).toBe('12 d')
    expect(textoDias(null)).toBe('—')
  })
})
