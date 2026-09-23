import { describe, expect, it } from 'vitest'
import {
  areaDeRevision,
  construccionLista,
  fechaConstruccionLista,
  indiceAreas,
  pendientesDe,
  pendientesTx,
  responsablesDe,
} from '.'
import type { GateSitio, SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { sitioProyecto } from '@/pruebas/fabricas'
import type { Area } from '@/domain/tipos/area'
import type { GateTemplate } from '@/domain/tipos/gate'

function area(id: string, nombre: string, extra: Partial<Area> = {}): Area {
  return {
    id,
    nombre,
    alias: [],
    responsables: [],
    porProyecto: {},
    activa: true,
    creadoEn: null,
    creadoPor: null,
    actualizadoEn: null,
    actualizadoPor: null,
    ...extra,
  }
}

const AREAS = [
  area('rf', 'RF', { responsables: ['u-ana'] }),
  area('implementacion', 'Implementación', { alias: ['IMPL'], responsables: ['u-beto'] }),
  area('oocc', 'OOCC', { responsables: ['u-ana'], porProyecto: { 'proy-2': ['u-carla'] } }),
]
const INDICE = indiceAreas(AREAS)

describe('areaDeRevision', () => {
  it('calza por id, nombre o alias, sin importar tildes ni mayusculas', () => {
    expect(areaDeRevision(INDICE, { id: 'rf' })?.id).toBe('rf')
    expect(areaDeRevision(INDICE, { id: 'x', nombre: 'Implementacion' })?.id).toBe('implementacion')
    expect(areaDeRevision(INDICE, { id: 'impl' })?.id).toBe('implementacion')
    expect(areaDeRevision(INDICE, { id: 'ece' })).toBeNull()
  })
})

describe('responsablesDe', () => {
  it('la excepcion del proyecto manda sobre el defecto', () => {
    const oocc = AREAS[2]!
    expect(responsablesDe(oocc, 'proy-1')).toEqual(['u-ana'])
    expect(responsablesDe(oocc, 'proy-2')).toEqual(['u-carla'])
  })
})

describe('pendientesDe', () => {
  const plantilla = {
    homologacion: {},
    gates: [
      {
        codigo: 'TSSR',
        revisiones: [
          { id: 'rf', nombre: 'RF', bloquea: true },
          { id: 'oocc', nombre: 'OOCC', bloquea: true },
          { id: 'implementacion', nombre: 'Implementación', bloquea: true },
        ],
      },
    ],
  } as unknown as GateTemplate

  it('son las areas de la etapa actual que aun no aprueban', () => {
    const base = sitioProyecto({ gateActual: 'TSSR' })
    const sp = {
      ...base,
      gates: {
        ...base.gates,
        TSSR: {
          ...base.gates.TSSR!,
          revisiones: {
            rf: { estado: 'TSS Aprobado', comentario: '', fecha: null, por: null, en: null },
            oocc: {
              estado: 'TSS Observado',
              comentario: 'Falta plano',
              fecha: null,
              por: null,
              en: null,
            },
          },
        },
      },
    }
    const p = pendientesDe(sp, plantilla, INDICE)
    expect(p.map((x) => x.area.id).sort()).toEqual(['implementacion', 'oocc'])
    expect(p.find((x) => x.area.id === 'oocc')).toMatchObject({
      estado: 'observado',
      comentario: 'Falta plano',
    })
  })

  it('un sitio cerrado no tiene pendientes', () => {
    expect(pendientesDe(sitioProyecto({ gateActual: 'CERRADO' }), plantilla, INDICE)).toEqual([])
  })
})

describe('pendientes de transmision', () => {
  const TX = indiceAreas([
    area('fo', 'FO', { alias: ['Fibra'] }),
    area('mmoo', 'MMOO'),
    area('ipran', 'IPRAN', { alias: ['UAN'] }),
  ])
  const gate = (nombre: string, estado: GateSitio['estado'], fechaReal: string | null = null) =>
    ({
      orden: 0,
      nombre,
      color: 'gris',
      siguiente: null,
      tipo: 'secuencial',
      estado,
      fechaPlan: null,
      fechaReal,
      fechaBaseline: null,
      responsableUid: null,
      proveedorId: null,
      checklist: {},
      revisiones: {},
      completadoEn: null,
      completadoPor: null,
    }) as GateSitio
  const sitio = (
    construccion: GateSitio['estado'],
    valores: SitioProyecto['valores'],
    tx: GateSitio['estado'] = 'no_iniciado',
    ipran: GateSitio['estado'] = 'no_iniciado',
  ) =>
    sitioProyecto({
      gateActual: 'AS_BUILT',
      gates: {
        CONSTRUCCION: gate('Construcción', construccion, '2026-05-10'),
        AS_BUILT: gate('As Built', 'en_curso'),
        TRANSMISION: gate('Transmisión', tx),
        IPRAN: gate('IPRAN', ipran),
      },
      valores,
    })

  it('antes de la construccion no hay nada pendiente', () => {
    expect(pendientesTx(sitio('en_curso', { 'tipo-tx': 'FO' }), null, TX)).toEqual([])
  })

  it('con la construccion lista, la Tx va al area de su tipo y la IPRAN a IPRAN', () => {
    const p = pendientesTx(
      sitio('completado', { 'tipo-tx': 'FO/On Net', 'status-tx': 'Poste' }),
      null,
      TX,
    )
    expect(p.map((x) => [x.area.id, x.revisionId, x.estado])).toEqual([
      ['fo', 'tx', 'en_revision'],
      ['ipran', 'ipran', 'no_recibido'],
    ])
    expect(p.every((x) => x.clase === 'tx')).toBe(true)
  })

  it('MMOO va a MMOO', () => {
    const p = pendientesTx(sitio('completado', { 'tipo-tx': 'MMOO' }), null, TX)
    expect(p[0]?.area.id).toBe('mmoo')
  })

  it('lo ya instalado o integrado no es pendiente', () => {
    expect(
      pendientesTx(sitio('completado', { 'tipo-tx': 'FO' }, 'completado', 'completado'), null, TX),
    ).toEqual([])
  })

  it('un tipo sin area (TBD, vacio) no se asigna, pero la IPRAN si', () => {
    const p = pendientesTx(sitio('completado', { 'tipo-tx': 'TBD' }), null, TX)
    expect(p.map((x) => x.area.id)).toEqual(['ipran'])
  })

  it('un sitio no vigente no tiene pendientes', () => {
    const sp = { ...sitio('completado', { 'tipo-tx': 'FO' }), vigente: false }
    expect(pendientesTx(sp, null, TX)).toEqual([])
  })

  it('la obra lista se sabe tambien por lo que viene despues, y desde cuando', () => {
    const sp = sitioProyecto({
      gateActual: 'CERRADO',
      gates: { ON_AIR: gate('On Air', 'completado', '2026-06-01') },
    })
    expect(construccionLista(sp)).toBe(true)
    expect(fechaConstruccionLista(sitio('completado', {}))).toBe('2026-05-10')
  })
})
