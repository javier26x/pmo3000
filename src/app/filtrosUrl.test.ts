import { describe, expect, it } from 'vitest'
import {
  aTextoUrl,
  desdeParametros,
  ESTADO_VACIO,
  ORDEN_POR_DEFECTO,
  sonIguales,
  type EstadoFiltros,
} from './filtrosUrl'

const con = (cambios: Partial<EstadoFiltros>): EstadoFiltros => ({
  ...ESTADO_VACIO,
  ...cambios,
  servidor: { ...ESTADO_VACIO.servidor, ...(cambios.servidor ?? {}) },
  vista: { ...ESTADO_VACIO.vista, ...(cambios.vista ?? {}) },
  orden: { ...ESTADO_VACIO.orden, ...(cambios.orden ?? {}) },
})

describe('codificacion de filtros en la URL', () => {
  it('sin filtros la URL queda vacia', () => {
    expect(aTextoUrl(ESTADO_VACIO)).toBe('')
  })

  it('no codifica el orden por defecto', () => {
    expect(aTextoUrl(con({ orden: ORDEN_POR_DEFECTO }))).toBe('')
    expect(aTextoUrl(con({ orden: { campo: 'sitio', direccion: 'asc' } }))).toBe('ord=sitio%3Aasc')
  })

  it('usa claves cortas y legibles', () => {
    const url = aTextoUrl(
      con({
        servidor: { ...ESTADO_VACIO.servidor, programaId: 'prog-1' },
        vista: { ...ESTADO_VACIO.vista, gateActual: 'FC', texto: 'maipu', soloAtrasados: true },
      }),
    )
    expect(url).toContain('prog=prog-1')
    expect(url).toContain('gate=FC')
    expect(url).toContain('q=maipu')
    expect(url).toContain('atr=1')
  })

  it('ida y vuelta conserva el estado', () => {
    const original = con({
      servidor: {
        programaId: 'prog-1',
        proyectoId: 'proy-2',
        proveedorId: 'prov-alfa',
        celulaId: 'cel-1',
      },
      vista: {
        gateActual: 'D7',
        texto: 'cerro azul',
        region: 'Biobio',
        comuna: 'Coronel',
        prioridad: 'critica',
        soloAtrasados: true,
        soloBloqueados: true,
      },
      orden: { campo: 'plan', direccion: 'asc' },
    })
    const vuelta = desdeParametros(new URLSearchParams(aTextoUrl(original)))
    expect(vuelta).toEqual(original)
    expect(sonIguales(original, vuelta)).toBe(true)
  })

  it('ignora valores invalidos en vez de romperse', () => {
    const p = new URLSearchParams('gate=INVENTADO&pri=urgentisima&ord=loquesea:arriba')
    const estado = desdeParametros(p)
    expect(estado.vista.gateActual).toBeNull()
    expect(estado.vista.prioridad).toBeNull()
    expect(estado.orden).toEqual(ORDEN_POR_DEFECTO)
  })

  it('trata los vacios y los espacios como ausencia de filtro', () => {
    const estado = desdeParametros(new URLSearchParams('q=%20%20&prog=&reg='))
    expect(estado.vista.texto).toBe('')
    expect(estado.servidor.programaId).toBeNull()
    expect(estado.vista.region).toBeNull()
  })

  it('acepta CERRADO como gate', () => {
    expect(desdeParametros(new URLSearchParams('gate=CERRADO')).vista.gateActual).toBe('CERRADO')
  })
})
