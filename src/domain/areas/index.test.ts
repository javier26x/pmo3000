import { describe, expect, it } from 'vitest'
import { areaDeRevision, indiceAreas, pendientesDe, responsablesDe } from '.'
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
