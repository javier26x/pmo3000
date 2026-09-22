import { describe, expect, it } from 'vitest'
import { detectarFilaEncabezado, inferirPlantilla, inferirTipo } from './inferencia'

/**
 * Las filas de estas pruebas estan copiadas de la forma de los trackers reales:
 * fila de relleno arriba, encabezado en la segunda, columnas de identidad, y
 * despues bloques por etapa con una revision por disciplina.
 */
const FILAS: unknown[][] = [
  ['', 1, null, null, null, null, null, null, null, null, null, null, null],
  [
    'search',
    'ID Sitio',
    'Site Name',
    'LATITUD',
    'LONGITUD',
    'Región',
    'COMUNA',
    'Colo/BTS',
    'Presentación TSS',
    'Status TSS RF',
    'Comentarios TSS RF',
    'TSS Fecha de Aprobación/obs RF',
    'Status Ing OOCC',
  ],
  [
    '',
    '23_695',
    'Holanda San Francisco',
    -33.5618,
    -70.6504,
    'Metropolitana de Santiago',
    'LA PINTANA',
    'BTS',
    new Date(Date.UTC(2026, 5, 3)),
    'TSS Aprobado',
    'Aprobado plan 160',
    new Date(Date.UTC(2026, 5, 3)),
    'Ing Aprobada',
  ],
  [
    '',
    '02_600',
    'Calama Alonso',
    -22.45,
    -68.93,
    'Antofagasta',
    'CALAMA',
    'COLO',
    new Date(Date.UTC(2026, 6, 14)),
    'TSS Observado',
    'Falta croquis',
    new Date(Date.UTC(2026, 6, 20)),
    'Ing No Recibida',
  ],
]

describe('detectarFilaEncabezado', () => {
  it('salta las filas de relleno que traen estos archivos', () => {
    expect(detectarFilaEncabezado(FILAS)).toBe(1)
  })

  it('con un archivo normal se queda en la primera', () => {
    expect(
      detectarFilaEncabezado([
        ['ID', 'Nombre', 'Región'],
        ['1', 'a', 'b'],
      ]),
    ).toBe(0)
  })
})

describe('inferirTipo', () => {
  it('reconoce una columna de fechas', () => {
    const fechas = [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 2)), null]
    expect(inferirTipo('Presentación TSS', fechas).tipo).toBe('fecha')
  })

  it('reconoce una lista de opciones y la deja ordenada', () => {
    const r = inferirTipo('Colo/BTS', ['BTS', 'COLO', 'BTS', 'BTS', 'COLO', 'BTS', 'COLO', 'BTS'])
    expect(r.tipo).toBe('opcion')
    expect(r.opciones).toEqual(['BTS', 'COLO'])
  })

  it('no confunde 300 nombres propios con una lista de opciones', () => {
    const nombres = Array.from({ length: 300 }, (_, i) => `Sitio ${i}`)
    expect(inferirTipo('Site Name', nombres).tipo).toBe('texto')
  })

  it('manda el contenido, no el encabezado: un "Status" de texto libre no es estado', () => {
    const muchos = Array.from({ length: 80 }, (_, i) => `valor distinto ${i}`)
    expect(inferirTipo('Status Tx', muchos).tipo).not.toBe('estado')
  })

  it('los comentarios largos y multilinea son texto largo', () => {
    expect(inferirTipo('Comentarios TSS ECE', ['linea uno\nlinea dos']).tipo).toBe('texto_largo')
  })

  it('una columna de ID numerico no se vuelve un numero', () => {
    // Si se volviera numero, "01_558" perderia el cero de la izquierda.
    expect(inferirTipo('ID OOII', [1, 2, 3, 4, 5]).tipo).toBe('texto')
  })

  it('una columna vacia no rompe nada', () => {
    expect(inferirTipo('Forecast', [null, '', null]).tipo).toBe('texto')
  })
})

describe('inferirPlantilla', () => {
  const p = inferirPlantilla(FILAS)

  it('encuentra las columnas de identidad', () => {
    expect(p.identidad.id).toBe(1)
    expect(p.identidad.nombre).toBe(2)
    expect(p.identidad.lat).toBe(3)
    expect(p.identidad.comuna).toBe(6)
  })

  it('deduce las etapas de las columnas de estado', () => {
    expect(p.etapas.map((e) => e.nombre)).toEqual(['TSS', 'Ingeniería'])
  })

  it('las ordena como estan en la planilla, que es el orden del proceso', () => {
    expect(p.etapas[0]!.orden).toBe(0)
    expect(p.etapas[1]!.orden).toBe(1)
  })

  it('separa la etapa de la disciplina que revisa', () => {
    expect(p.etapas[0]!.revisiones.map((r) => r.nombre)).toEqual(['RF'])
    expect(p.etapas[1]!.revisiones.map((r) => r.nombre)).toEqual(['OOCC'])
  })

  it('traduce el nombre corto al nombre bueno', () => {
    // La planilla dice "Ing"; la etapa se llama Ingeniería.
    expect(p.etapas.map((e) => e.nombre)).toContain('Ingeniería')
  })

  it('agrupa cada columna en su etapa', () => {
    const porNombre = new Map(p.columnas.map((c) => [c.encabezado, c.campo.grupo]))
    expect(porNombre.get('Presentación TSS')).toBe('TSS')
    expect(porNombre.get('Comentarios TSS RF')).toBe('TSS')
    expect(porNombre.get('TSS Fecha de Aprobación/obs RF')).toBe('TSS')
    expect(porNombre.get('Status Ing OOCC')).toBe('Ingeniería')
  })

  it('deja los atributos del sitio fuera de las etapas', () => {
    // Colo/BTS va antes del primer bloque: es del sitio, no de TSS.
    const colo = p.columnas.find((c) => c.encabezado === 'Colo/BTS')
    expect(colo?.campo.grupo).toBe('General')
  })

  it('no propone columnas vacias', () => {
    expect(p.columnas.some((c) => c.encabezado === 'search')).toBe(false)
  })

  it('distingue el rol de cada columna', () => {
    const porNombre = new Map(p.columnas.map((c) => [c.encabezado, c.rol]))
    expect(porNombre.get('Status TSS RF')).toBe('estado')
    expect(porNombre.get('Comentarios TSS RF')).toBe('comentario')
    expect(porNombre.get('TSS Fecha de Aprobación/obs RF')).toBe('fecha')
    expect(porNombre.get('ID Sitio')).toBe('identidad')
  })

  it('en la tabla deja solo el estado consolidado, no una columna por disciplina', () => {
    // Con ciento cuarenta columnas, mostrarlas todas no es una tabla.
    const enTabla = p.columnas.filter((c) => c.campo.enTabla)
    expect(enTabla.every((c) => c.rol === 'estado' && c.revision === null)).toBe(true)
  })

  it('da ids estables derivados del encabezado', () => {
    const c = p.columnas.find((x) => x.encabezado === 'Status TSS RF')
    expect(c?.campo.id).toBe('status-tss-rf')
  })

  it('avisa cuando no encuentra las columnas obligatorias', () => {
    const sinId = inferirPlantilla([
      ['Nombre', 'Otra'],
      ['a', 'b'],
    ])
    expect(sinId.avisos.join(' ')).toContain('ID de sitio')
  })

  it('avisa cuando no hay ninguna columna de estado', () => {
    const sinEtapas = inferirPlantilla([
      ['ID Sitio', 'Site Name'],
      ['1', 'Uno'],
    ])
    expect(sinEtapas.etapas).toHaveLength(0)
    expect(sinEtapas.avisos.join(' ')).toContain('No se reconocieron etapas')
  })

  it('una hoja sin datos bajo el encabezado se avisa, no revienta', () => {
    const vacia = inferirPlantilla([['ID Sitio', 'Status TSS RF']])
    expect(vacia.avisos.join(' ')).toContain('no tiene filas de datos')
  })
})
