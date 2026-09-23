import { describe, expect, it } from 'vitest'
import { etapaAplica, hojaTienePerfil, leerHito, perfilDeEncabezados } from './perfiles'
import { inferirPlantilla } from './inferencia'
import { convertirFila, indexarColumnas, type FilaTracker } from './aplicacion'

/**
 * Encabezado con la forma del control de RWK: identidad, el tipo y el ano de la
 * intervencion, los bloques HW / REQUIERE / DESARME / SITIO AL AIRE, y los
 * encabezados repetidos que trae el archivo real ("Fecha" tres veces, "Estatus"
 * al principio y al final, "Baja de Contrato" dos veces).
 */
const ENCABEZADO = [
  'Estatus', // 0: estado de la carga del acta, no de la intervencion
  'Año', // 1
  'Sitio', // 2
  'Nombre', // 3
  'Región', // 4
  'Tipo', // 5
  'Fecha de Acta', // 6
  'Informado Areas', // 7
  'Gabinete', // 8
  'Fecha', // 9
  'CSR', // 10
  'Fecha', // 11
  'MMOO', // 12
  'Fecha', // 13
  'Bloqueo de celdas', // 14
  'Dar de baja', // 15
  'Baja de Contrato', // 16
  'Desarme', // 17
  'Desconexión Empalme', // 18
  'Desconexión FO', // 19
  'Baja de sitio-NOC', // 20
  'Baja de Contrato', // 21
  'RFI OOII', // 22
  'RFI PMO', // 23
  'Informado a SWAP HUAWEI / IN HOUSE /INMO / OOII', // 24
  'Fecha de termino', // 25
  'Estatus', // 26
  'PASO O&M ECE', // 27
]

const F = (iso: string) => new Date(`${iso}T12:00:00Z`)

function fila(valores: Record<number, unknown>): unknown[] {
  return ENCABEZADO.map((_, i) => valores[i] ?? null)
}

// prettier-ignore
const FILAS: unknown[][] = [
  ['AUDITORIA', null, null, null, null, null, null, null, 'HW'],
  ENCABEZADO,
  // Desarme a secas, en curso: HW y Sitio al aire no corresponden.
  fila({ 0: 'Cargado', 1: 2025, 2: '13_937', 3: 'Enea', 5: 'Desarme', 6: F('2025-03-01'), 7: F('2025-03-02'),
    14: 'OK', 15: 'No', 16: 'No', 17: F('2025-04-10'), 18: '06-01-25_Consulto a Marco', 19: '-', 20: '-', 21: '-',
    26: 'En proceso' }),
  // RWK del mismo sitio, en HW: el desarme no corresponde.
  fila({ 1: 2026, 2: '13_937', 3: 'Enea', 5: 'RWK', 6: F('2026-01-15'), 7: '-', 9: F('2026-02-01'), 11: 'Pendiente',
    13: '-', 26: 'En proceso' }),
  // Terminado sin nada anotado: cierra entero.
  fila({ 1: 2024, 2: '01_022/01S_004', 3: 'Doble', 5: 'RWK / RFI SWAP', 25: F('2024-07-29'), 26: 'Terminado' }),
  // Fuera de plan.
  fila({ 1: 2026, 2: '05_755', 3: 'San Francisco', 5: 'RWK', 26: 'Fuera de plan' }),
  // Todo hecho menos el estatus: queda en Termino.
  fila({ 1: 2026, 2: '08_104', 3: 'Chillan', 5: 'RWK', 6: F('2026-01-10'), 7: F('2026-01-11'),
    9: F('2026-02-01'), 11: F('2026-02-02'), 13: '-', 22: F('2026-03-01'), 23: F('2026-03-02'), 24: F('2026-03-03'),
    25: '-', 27: '-', 26: 'En proceso' }),
]

describe('perfilDeEncabezados', () => {
  it('reconoce el control de RWK por sus columnas', () => {
    expect(perfilDeEncabezados(ENCABEZADO)?.nombre).toBe('Control RWK')
    expect(hojaTienePerfil(FILAS)).toBe(true)
  })

  it('no reconoce un tracker de despliegue', () => {
    expect(perfilDeEncabezados(['ID Sitio', 'Status TSS RF', 'Desarme'])).toBeNull()
  })
})

describe('leerHito', () => {
  it('una fecha es el paso hecho ese dia', () => {
    expect(leerHito(F('2025-04-10'), true)).toEqual({
      estado: '2025-04-10',
      comentario: '',
      fecha: '2025-04-10',
    })
  })

  it('una nota de seguimiento deja el paso en curso y se guarda como comentario', () => {
    expect(leerHito('06-01-25_Consulto a Marco', true)).toEqual({
      estado: 'En proceso',
      comentario: '06-01-25_Consulto a Marco',
      fecha: null,
    })
  })

  it('un "no existe" o un N/A con explicacion no corresponde', () => {
    expect(leerHito('No existe conexión eléctrica de Empalme.', true).estado).toBe('No aplica')
    expect(leerHito('N/A, ya ejecutado en Sep-2023', true).estado).toBe('No aplica')
  })

  it('un ano suelto es un paso hecho', () => {
    expect(leerHito(2024, true).estado).toBe('Terminado 2024')
  })

  it('vacia es pendiente, salvo que la etapa no aplique a la intervencion', () => {
    expect(leerHito(null, true).estado).toBe('')
    expect(leerHito(null, false).estado).toBe('No aplica')
  })
})

describe('etapaAplica', () => {
  it('HW corre en todo lo que no sea un desarme a secas', () => {
    const hw = { salvo: '^desarme$' }
    expect(etapaAplica(hw, 'Desarme')).toBe(false)
    expect(etapaAplica(hw, 'Desarme+RWK')).toBe(true)
    expect(etapaAplica(hw, 'Siniestrado / RFI SWAP')).toBe(true)
  })

  it('el desarme solo corre si el tipo lo nombra', () => {
    expect(etapaAplica({ si: 'desarme' }, 'RWK')).toBe(false)
    expect(etapaAplica({ si: 'desarme' }, 'Desarme+RWK')).toBe(true)
  })
})

describe('control de RWK importado', () => {
  const p = inferirPlantilla(FILAS)
  const indice = indexarColumnas(p)
  const filas = FILAS.slice(2).map((f) => convertirFila(f, p, indice))
  const [desarme, rwk, terminado, fueraDePlan, enTermino] = filas as [
    FilaTracker,
    FilaTracker,
    FilaTracker,
    FilaTracker,
    FilaTracker,
  ]
  const etapa = (f: FilaTracker, nombre: string) => f.etapas.find((e) => e.nombre === nombre)!

  it('propone las etapas del proceso, con el desarme en paralelo', () => {
    expect(p.perfil?.nombre).toBe('Control RWK')
    expect(p.etapas.map((e) => [e.nombre, e.tipo])).toEqual([
      ['Acta', 'secuencial'],
      ['HW', 'secuencial'],
      ['Sitio al aire', 'secuencial'],
      ['Desarme', 'paralela'],
      ['Término', 'secuencial'],
    ])
    expect(p.avisos).toEqual([])
  })

  it('toma las columnas repetidas por su posicion', () => {
    const hw = p.columnas.filter((c) => c.etapa === 'HW').map((c) => [c.indice, c.revision])
    expect(hw).toEqual([
      [9, 'Gabinete'],
      [11, 'CSR'],
      [13, 'MMOO'],
    ])
    const bajas = p.columnas.filter((c) => c.encabezado === 'Baja de Contrato')
    expect(bajas.map((c) => c.revision)).toEqual(['Requiere baja de contrato', 'Baja de contrato'])
    // El estatus de la intervencion es el del final, no el de la carga del acta.
    expect(p.condicion.vigencia).toBe(26)
  })

  it('un desarme no espera HW ni sitio al aire', () => {
    expect(etapa(desarme, 'HW').cerrada).toBe(true)
    expect(etapa(desarme, 'HW').revisiones['gabinete']?.estado).toBe('No aplica')
    expect(etapa(desarme, 'Desarme').cerrada).toBe(false)
    expect(etapa(desarme, 'Desarme').revisiones['desconexion-empalme']).toEqual({
      estado: 'En proceso',
      comentario: '06-01-25_Consulto a Marco',
      fecha: null,
    })
    expect(desarme.etapaActual).toBe('TERMINO')
  })

  it('un RWK sin desarme queda en la etapa que le falta', () => {
    expect(etapa(rwk, 'Desarme').cerrada).toBe(true)
    expect(rwk.etapaActual).toBe('HW')
  })

  it('el mismo sitio con dos intervenciones da dos claves', () => {
    expect(desarme.sitio.id).toBe(rwk.sitio.id)
    expect(desarme.intervencion).toEqual({ clave: 'desarme-2025', etiqueta: 'Desarme 2025' })
    expect(rwk.intervencion?.clave).toBe('rwk-2026')
  })

  it('terminado cierra todo aunque no haya nada anotado', () => {
    expect(terminado.etapaActual).toBe('CERRADO')
    expect(terminado.etapas.every((e) => e.cerrada)).toBe(true)
  })

  it('un ID con barra se guarda sin ella', () => {
    expect(terminado.sitio.id).toBe('01_022-01S_004')
  })

  it('fuera de plan no es vigente', () => {
    expect(fueraDePlan.condicion?.vigente).toBe(false)
  })

  it('termino solo cierra con el estatus', () => {
    expect(etapa(enTermino, 'Sitio al aire').cerrada).toBe(true)
    expect(etapa(enTermino, 'Término').cerrada).toBe(false)
    expect(enTermino.etapaActual).toBe('TERMINO')
  })

  it('un tracker con columnas Status no usa el perfil aunque comparta encabezados', () => {
    const conStatus = inferirPlantilla([
      [...ENCABEZADO, 'Status TSS RF'],
      [...fila({ 2: '1', 3: 'a' }), 'TSS Aprobado'],
    ])
    expect(conStatus.perfil).toBeUndefined()
    expect(conStatus.etapas.map((e) => e.nombre)).toEqual(['TSS'])
  })
})
