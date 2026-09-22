import { describe, expect, it } from 'vitest'
import { inferirPlantilla } from './inferencia'
import {
  avanceFueraDeOrden,
  construirGates,
  convertirFila,
  indexarColumnas,
  primeraAbierta,
} from './aplicacion'

/** Dos etapas con dos disciplinas cada una, como en los trackers reales. */
const ENCABEZADOS = [
  'ID Sitio',
  'Site Name',
  'Región',
  'COMUNA',
  'Colo/BTS',
  'Status TSS RF',
  'Comentarios TSS RF',
  'TSS Fecha de Aprobación/obs RF',
  'Status TSS OOCC',
  'Comentarios TSS OOCC',
  'TSS Fecha de Aprobación/obs OOCC',
  'Status TSS',
  'Status Ing RF',
  'Comentarios Ing RF',
  'Ing Fecha de Aprobación/Obs RF',
  'Status Ing',
]

function armar(filas: unknown[][]) {
  const completas = [ENCABEZADOS, ...filas]
  const plantilla = inferirPlantilla(completas)
  return { plantilla, indice: indexarColumnas(plantilla), filas }
}

const F = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))

describe('convertirFila', () => {
  const { plantilla, indice, filas } = armar([
    [
      '23_695',
      'Holanda San Francisco',
      'Metropolitana',
      'LA PINTANA',
      'BTS',
      'TSS Aprobado',
      'Sin observaciones',
      F(2026, 6, 3),
      'TSS Aprobado con Observaciones',
      'Revisar altura',
      F(2026, 6, 10),
      'TSS Aprobado',
      'Ing No Recibida',
      '',
      null,
      'Ing No Recibida',
    ],
  ])
  const fila = convertirFila(filas[0]!, plantilla, indice)

  it('saca la identidad del sitio', () => {
    expect(fila.sitio.id).toBe('23_695')
    expect(fila.sitio.nombre).toBe('Holanda San Francisco')
    expect(fila.sitio.comuna).toBe('LA PINTANA')
  })

  it('guarda el estado de cada disciplina con su texto original', () => {
    const tss = fila.etapas.find((e) => e.codigo === 'TSS')!
    expect(tss.revisiones.rf?.estado).toBe('TSS Aprobado')
    expect(tss.revisiones.oocc?.estado).toBe('TSS Aprobado con Observaciones')
  })

  it('engancha el comentario y la fecha con su disciplina, no con otra', () => {
    // Las tres columnas de una revision estan separadas en la planilla y solo
    // se reconocen porque mencionan la misma disciplina.
    const tss = fila.etapas.find((e) => e.codigo === 'TSS')!
    expect(tss.revisiones.rf?.comentario).toBe('Sin observaciones')
    expect(tss.revisiones.rf?.fecha).toBe('2026-06-03')
    expect(tss.revisiones.oocc?.comentario).toBe('Revisar altura')
    expect(tss.revisiones.oocc?.fecha).toBe('2026-06-10')
  })

  it('la fecha de la etapa es la mas tardia de sus revisiones', () => {
    const tss = fila.etapas.find((e) => e.codigo === 'TSS')!
    expect(tss.fecha).toBe('2026-06-10')
  })

  it('deduce en que etapa esta parado el sitio', () => {
    expect(fila.etapaActual).toBe('INGENIERIA')
  })

  it('guarda las columnas que no son de revision como valores del sitio', () => {
    expect(fila.valores['colo-bts']).toBe('BTS')
  })
})

describe('el consolidado del tracker manda sobre las revisiones', () => {
  it('una etapa cierra aunque una disciplina no haya opinado', () => {
    // Es el caso real: MMOO revisa el 6% de los sitios. Exigiendo que las cinco
    // revisiones de TSS cierren, el 95% de los sitios se quedaba en TSS por una
    // celda vacia, cuando la propia planilla los daba por aprobados.
    const { plantilla, indice, filas } = armar([
      [
        '01_1',
        'Uno',
        'RM',
        'Maipu',
        'BTS',
        'TSS Aprobado',
        '',
        null,
        '',
        '',
        null,
        'TSS Aprobado',
        'Ing No Recibida',
        '',
        null,
        'Ing No Recibida',
      ],
    ])
    const fila = convertirFila(filas[0]!, plantilla, indice)
    const tss = fila.etapas.find((e) => e.codigo === 'TSS')!
    expect(tss.cerrada).toBe(true)
    expect(fila.etapaActual).toBe('INGENIERIA')
  })

  it('pero el resumen sigue mostrando que hay una revision sin llegar', () => {
    const { plantilla, indice, filas } = armar([
      [
        '01_1',
        'Uno',
        'RM',
        'Maipu',
        'BTS',
        'TSS Aprobado',
        '',
        null,
        '',
        '',
        null,
        'TSS Aprobado',
        'Ing No Recibida',
        '',
        null,
        'Ing No Recibida',
      ],
    ])
    const tss = convertirFila(filas[0]!, plantilla, indice).etapas.find((e) => e.codigo === 'TSS')!
    expect(tss.resumen).toBe('en_revision')
    expect(tss.consolidado).toBe('aprobado')
  })
})

describe('primeraAbierta', () => {
  const etapa = (codigo: string, cerrada: boolean) => ({
    codigo,
    resumen: 'aprobado' as const,
    consolidado: null,
    cerrada,
    fecha: null,
    revisiones: {},
  })

  it('devuelve la primera sin cerrar aunque las de mas adelante esten cerradas', () => {
    // Pasa de verdad en los trackers: alguien aprueba el As Built antes de que
    // cierre la Ingenieria. Lo que frena al sitio es la que quedo atras.
    expect(primeraAbierta([etapa('A', true), etapa('B', false), etapa('C', true)])).toBe('B')
  })

  it('con todas cerradas el sitio sale del flujo', () => {
    expect(primeraAbierta([etapa('A', true), etapa('B', true)])).toBe('CERRADO')
  })
})

describe('avanceFueraDeOrden', () => {
  const fila = {
    sitio: { id: '1', nombre: '', region: '', comuna: '', direccion: '', lat: null, lon: null },
    valores: {},
    problemas: [],
    etapaActual: 'B',
    etapas: [
      {
        codigo: 'A',
        resumen: 'aprobado' as const,
        consolidado: null,
        cerrada: true,
        fecha: null,
        revisiones: {},
      },
      {
        codigo: 'B',
        resumen: 'no_recibido' as const,
        consolidado: null,
        cerrada: false,
        fecha: null,
        revisiones: {},
      },
      {
        codigo: 'C',
        resumen: 'aprobado' as const,
        consolidado: null,
        cerrada: true,
        fecha: null,
        revisiones: {},
      },
    ],
  }

  it('detecta las etapas aprobadas despues de la que frena', () => {
    expect(avanceFueraDeOrden(fila)).toEqual(['C'])
  })
})

describe('construirGates', () => {
  const { plantilla, indice, filas } = armar([
    [
      '01_1',
      'Uno',
      'RM',
      'Maipu',
      'BTS',
      'TSS Aprobado',
      '',
      F(2026, 3, 9),
      'TSS Aprobado',
      '',
      F(2026, 3, 9),
      'TSS Aprobado',
      'Ing No Recibida',
      '',
      null,
      'Ing No Recibida',
    ],
  ])
  const gates = construirGates(convertirFila(filas[0]!, plantilla, indice), {
    responsableUid: null,
    proveedorId: null,
  })

  it('enlaza cada etapa con la siguiente, que es lo que validan las reglas', () => {
    expect(gates.TSS?.siguiente).toBe('INGENIERIA')
    expect(gates.INGENIERIA?.siguiente).toBeNull()
  })

  it('una etapa cerrada llega con estado completado y fecha real', () => {
    // Las reglas del servidor exigen las dos cosas para dejar avanzar.
    expect(gates.TSS?.estado).toBe('completado')
    expect(gates.TSS?.fechaReal).toBe('2026-03-09')
  })

  it('la etapa donde esta parado queda en curso', () => {
    expect(gates.INGENIERIA?.estado).toBe('en_curso')
    expect(gates.INGENIERIA?.fechaReal).toBeNull()
  })
})

describe('regla de tecnologia en sitios 5G', () => {
  const encabezados = [...ENCABEZADOS, 'Proyecto']
  const fila5g = (tss: string, ing: string) => [
    '53_336',
    'Sitio 5G',
    'Biobío',
    'CONCEPCION',
    'BTS',
    tss,
    '',
    F(2025, 3, 1),
    tss,
    '',
    F(2025, 3, 1),
    tss,
    ing,
    '',
    null,
    ing,
    '5G',
  ]

  function convertir(tss: string, ing: string) {
    const fila = fila5g(tss, ing)
    const plantilla = inferirPlantilla([encabezados, fila])
    return convertirFila(fila, plantilla, indexarColumnas(plantilla))
  }

  it('un aprobado solo 4G no cierra la etapa de un sitio 5G', () => {
    expect(convertir('TSS Aprobado 4G', 'Ing No Recibida 4G').etapaActual).toBe('TSS')
  })

  it('pero si una etapa posterior quedo aprobada para 5G, lo anterior ya esta cubierto', () => {
    // Tracker Outdoor: "TSS Aprobado 4G" + "Ing Aprobada 4G/5G" es un sitio que
    // la PMO da por "On Air 4G/5G"; el rotulo del TSS nadie lo actualizo.
    const fila = convertir('TSS Aprobado 4G', 'Ing Aprobada 4G/5G')
    expect(fila.etapas.find((e) => e.codigo === 'TSS')?.cerrada).toBe(true)
    expect(fila.etapaActual).toBe('CERRADO')
  })
})
