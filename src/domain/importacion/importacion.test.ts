import { describe, expect, it } from 'vitest'
import {
  detectarMapeo,
  columnasIgnoradas,
  faltantesObligatorios,
  normalizarCabecera,
} from './mapeo'
import { parsearNumero, resumirImportacion, validarArchivo, validarFila } from './validacion'

describe('normalizarCabecera', () => {
  it('quita acentos, espacios y simbolos', () => {
    expect(normalizarCabecera('ID Sitio')).toBe('idsitio')
    expect(normalizarCabecera('Región')).toBe('region')
    expect(normalizarCabecera('  Latitud (WGS84) ')).toBe('latitudwgs84')
  })
})

describe('detectarMapeo', () => {
  it('detecta las cabeceras tipicas de la planilla', () => {
    const mapeo = detectarMapeo([
      'ID Sitio',
      'Nombre',
      'Región',
      'Comuna',
      'Latitud',
      'Longitud',
      'Tecnología',
      'Programa',
    ])
    expect(mapeo).toMatchObject({
      id: 0,
      nombre: 1,
      region: 2,
      comuna: 3,
      lat: 4,
      lon: 5,
      tecnologias: 6,
      programa: 7,
    })
    expect(faltantesObligatorios(mapeo)).toEqual([])
  })

  it('detecta cabeceras con texto extra por contencion', () => {
    const mapeo = detectarMapeo([
      'Codigo Sitio',
      'Nombre del sitio',
      'Latitud (WGS84)',
      'Longitud (WGS84)',
    ])
    expect(mapeo.nombre).toBe(1)
    expect(mapeo.lat).toBe(2)
    expect(mapeo.lon).toBe(3)
  })

  it('no asigna dos campos a la misma columna', () => {
    const mapeo = detectarMapeo(['Latitud', 'Longitud'])
    expect(mapeo.lat).not.toBe(mapeo.lon)
  })

  it('reporta los obligatorios que no encontro', () => {
    const mapeo = detectarMapeo(['ID Sitio', 'Nombre'])
    expect(faltantesObligatorios(mapeo).sort()).toEqual(['comuna', 'lat', 'lon', 'region'])
  })

  it('lista las columnas que quedaron sin usar', () => {
    const cabeceras = ['ID Sitio', 'Nombre', 'Notas internas']
    expect(columnasIgnoradas(cabeceras, detectarMapeo(cabeceras))).toEqual(['Notas internas'])
  })
})

describe('parsearNumero', () => {
  it('acepta coma y punto decimal', () => {
    expect(parsearNumero('-33,4372')).toBe(-33.4372)
    expect(parsearNumero('-33.4372')).toBe(-33.4372)
    expect(parsearNumero(' -70,66 ')).toBe(-70.66)
  })

  it('acepta el signo menos tipografico de Excel', () => {
    expect(parsearNumero('−33,4372')).toBe(-33.4372)
  })

  it('rechaza texto', () => {
    expect(parsearNumero('sin dato')).toBeNull()
    expect(parsearNumero('')).toBeNull()
  })
})

const MAPEO = {
  id: 0,
  nombre: 1,
  region: 2,
  comuna: 3,
  lat: 4,
  lon: 5,
  tecnologias: 6,
  programa: 7,
  fechaInicio: 8,
}

describe('validarFila', () => {
  it('convierte una fila correcta en un sitio', () => {
    const r = validarFila(
      [
        'STGO-0001',
        'Cerro Ficticio',
        'Metropolitana',
        'Maipu',
        '-33,50',
        '-70,76',
        '4G;5G',
        'Plan 200',
        '01-02-2026',
      ],
      MAPEO,
      2,
    )
    expect(r.errores).toEqual([])
    expect(r.sitio).toMatchObject({
      id: 'STGO-0001',
      nombre: 'Cerro Ficticio',
      lat: -33.5,
      lon: -70.76,
      tecnologias: ['4G', '5G'],
    })
    expect(r.programa).toBe('Plan 200')
    expect(r.fechaInicio).toBe('2026-02-01')
  })

  it('marca error cuando falta un campo obligatorio', () => {
    const r = validarFila(['', 'Nombre', 'Region', 'Comuna', '-33', '-70'], MAPEO, 2)
    expect(r.estado).toBe('error')
    expect(r.sitio).toBeNull()
    expect(r.errores.some((e) => e.campo === 'id')).toBe(true)
  })

  it('marca error cuando la coordenada no es numerica', () => {
    const r = validarFila(['S1', 'N', 'R', 'C', 'sin dato', '-70'], MAPEO, 2)
    expect(r.errores.some((e) => e.campo === 'lat')).toBe(true)
  })

  it('avisa (sin bloquear) cuando la coordenada cae fuera de Chile', () => {
    const r = validarFila(['S1', 'N', 'R', 'C', '40,4', '-3,7'], MAPEO, 2)
    expect(r.errores).toEqual([])
    expect(r.avisos.some((a) => a.mensaje.includes('fuera de Chile'))).toBe(true)
  })

  it('detecta latitud y longitud invertidas', () => {
    const r = validarFila(['S1', 'N', 'R', 'C', '-70,76', '-33,50'], MAPEO, 2)
    expect(r.avisos.some((a) => a.mensaje.includes('invertidas'))).toBe(true)
  })

  it('avisa cuando no puede interpretar la fecha', () => {
    const r = validarFila(['S1', 'N', 'R', 'C', '-33,5', '-70,7', '', '', 'proximo mes'], MAPEO, 2)
    expect(r.fechaInicio).toBeNull()
    expect(r.avisos.some((a) => a.campo === 'fechaInicio')).toBe(true)
  })

  it('rechaza un ID con barra', () => {
    const r = validarFila(['A/B', 'N', 'R', 'C', '-33,5', '-70,7'], MAPEO, 2)
    expect(r.errores.some((e) => e.mensaje.includes('"/"'))).toBe(true)
  })
})

describe('validarArchivo', () => {
  const fila = (id: string) => [id, 'Nombre', 'Region', 'Comuna', '-33,5', '-70,7', '', '', '']

  it('numera las filas como las ve el usuario (cabecera = 1)', () => {
    const r = validarArchivo([fila('A')], MAPEO, new Set())
    expect(r[0]?.numeroFila).toBe(2)
  })

  it('ignora filas totalmente vacias', () => {
    const r = validarArchivo([fila('A'), ['', '', '', '', '', ''], fila('B')], MAPEO, new Set())
    expect(r).toHaveLength(2)
  })

  it('marca el segundo ID repetido del archivo', () => {
    const r = validarArchivo([fila('A'), fila('A')], MAPEO, new Set())
    expect(r[0]?.estado).toBe('nuevo')
    expect(r[1]?.estado).toBe('duplicado_archivo')
    expect(r[1]?.errores[0]?.mensaje).toContain('fila 2')
  })

  it('marca como actualizacion los sitios que ya existen en el maestro', () => {
    const r = validarArchivo([fila('A'), fila('B')], MAPEO, new Set(['A']))
    expect(r[0]?.estado).toBe('actualiza')
    expect(r[1]?.estado).toBe('nuevo')
  })
})

describe('resumirImportacion', () => {
  it('cuenta lo que se va a escribir', () => {
    const fila = (id: string) => [id, 'N', 'R', 'C', '-33,5', '-70,7', '', '', '']
    const filas = validarArchivo(
      [fila('A'), fila('A'), fila('B'), ['', 'N', 'R', 'C', '-33,5', '-70,7']],
      MAPEO,
      new Set(['B']),
    )
    expect(resumirImportacion(filas)).toMatchObject({
      total: 4,
      nuevos: 1,
      actualizan: 1,
      duplicadosArchivo: 1,
      conError: 1,
      importables: 2,
    })
  })
})
