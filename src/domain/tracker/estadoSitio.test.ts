import { describe, expect, it } from 'vitest'
import { inferirPlantilla } from './inferencia'
import {
  avanceFueraDeOrden,
  construirGates,
  construirPlantilla,
  convertirFila,
  indexarColumnas,
  primeraAbierta,
} from './aplicacion'
import { condicionDelSitio, estadoSitio, estadoSitioDesdeTexto, hitoDeEtapa } from './estadoSitio'
import { resumirCalidad, tipoDiscrepancia } from './calidad'

/**
 * Un tracker con la forma del Outdoor real, recortado: el proceso TSS ->
 * Ingenieria -> Construccion -> As Built -> On Air, con FC, contrato, OOEE e
 * IPRAN como requisitos paralelos, la vigencia, la fase y el Status Sitio que
 * se escribe a mano.
 */
const ENCABEZADOS = [
  'ID Sitio',
  'Site Name',
  'Proyecto',
  'Vigencia',
  'Status TSS RF',
  'Status TSS OOCC',
  'Status TSS',
  'Status FC',
  'Status Contrato',
  'Status Ing RF',
  'Status Ing OOCC',
  'Status Ing',
  'Estado OOCC',
  'Estado OOEE',
  'Status Asbuilt RF',
  'Status Asbuilt OOCC',
  'Status Asbuilt',
  'Status IPRAN',
  'Fecha Sitio On Air',
  'Sitios On air',
  'Status Sitio',
]

type Celdas = Partial<Record<(typeof ENCABEZADOS)[number], unknown>>

function fila(id: string, celdas: Celdas): unknown[] {
  return ENCABEZADOS.map((e) =>
    e === 'ID Sitio' ? id : e === 'Site Name' ? `Sitio ${id}` : (celdas[e] ?? null),
  )
}

const APROBADO_HASTA_ING: Celdas = {
  Proyecto: 'Fase 1',
  Vigencia: 'Vigente',
  'Status TSS RF': 'TSS Aprobado',
  'Status TSS OOCC': 'TSS Aprobado',
  'Status TSS': 'TSS Aprobado',
  'Status FC': 'Pendiente FC',
  'Status Contrato': 'Contrato No Firmado',
  'Status Ing RF': 'Ing Aprobada',
  'Status Ing OOCC': 'Ing Aprobada',
  'Status Ing': 'Ing Aprobada 4G',
  'Estado OOCC': 'No Iniciadas',
  'Estado OOEE': 'No iniciadas',
  'Status Asbuilt RF': 'As Built No Recibido',
  'Status Asbuilt OOCC': 'As Built No Recibido',
  'Status Asbuilt': 'As Built No Recibido',
}

const ON_AIR: Celdas = {
  ...APROBADO_HASTA_ING,
  'Status FC': 'FC Enviado a OOII',
  'Status Contrato': 'Contrato Firmado',
  'Estado OOCC': 'Finalizadas',
  'Estado OOEE': 'Finalizadas',
  'Status Asbuilt RF': 'As Built Aprobado',
  'Status Asbuilt OOCC': 'As Built Aprobado',
  'Status Asbuilt': 'As Built Aprobado con Observaciones 4G',
  'Status IPRAN': 'Integrado',
  'Fecha Sitio On Air': new Date(Date.UTC(2024, 7, 29)),
  'Sitios On air': 'On Air',
  'Status Sitio': 'On Air 4G',
}

function armar(filas: unknown[][]) {
  const plantilla = inferirPlantilla([ENCABEZADOS, ...filas])
  const indice = indexarColumnas(plantilla)
  return {
    plantilla,
    convertir: (i: number) => convertirFila(filas[i]!, plantilla, indice),
  }
}

describe('inferencia sobre un tracker con requisitos paralelos', () => {
  const { plantilla } = armar([fila('01_043', ON_AIR)])
  const tipo = (nombre: string) => plantilla.etapas.find((e) => e.nombre === nombre)?.tipo

  it('propone el proceso como secuencial y los requisitos como paralelos', () => {
    expect(plantilla.etapas.map((e) => e.nombre)).toEqual([
      'TSS',
      'FC',
      'Contrato',
      'Ingeniería',
      'Construcción',
      'OOEE',
      'As Built',
      'IPRAN',
      'On Air',
    ])
    for (const n of ['TSS', 'Ingeniería', 'Construcción', 'As Built', 'On Air']) {
      expect(tipo(n)).toBe('secuencial')
    }
    for (const n of ['FC', 'Contrato', 'OOEE', 'IPRAN']) expect(tipo(n)).toBe('paralela')
  })

  it('"Estado OOCC" es la etapa de Construcción y OOCC sigue siendo disciplina', () => {
    const ing = plantilla.etapas.find((e) => e.nombre === 'Ingeniería')
    expect(ing?.revisiones.map((r) => r.nombre)).toContain('OOCC')
    const oocc = plantilla.columnas.find((c) => c.encabezado === 'Status Ing OOCC')
    expect(oocc?.etapa).toBe('Ingeniería')
  })

  it('el Status Sitio no es una etapa: es una columna para comparar', () => {
    expect(plantilla.etapas.some((e) => e.nombre === 'Sitio')).toBe(false)
    const col = plantilla.columnas.find((c) => c.encabezado === 'Status Sitio')
    expect(col?.rol).toBe('estadoSitio')
    expect(col?.etapa).toBeNull()
    expect(plantilla.condicion.estadoSitio).toBe(ENCABEZADOS.indexOf('Status Sitio'))
  })

  it('reconoce la vigencia y la fase', () => {
    expect(plantilla.condicion.vigencia).toBe(ENCABEZADOS.indexOf('Vigencia'))
    expect(plantilla.condicion.fase).toBe(ENCABEZADOS.indexOf('Proyecto'))
    expect(plantilla.columnas.find((c) => c.encabezado === 'Vigencia')?.rol).toBe('vigencia')
  })

  it('agrega On Air como ultimo paso, con su estado y su fecha', () => {
    const onAir = plantilla.etapas.at(-1)
    expect(onAir?.nombre).toBe('On Air')
    expect(onAir?.cierraConFecha).toBe(true)
    const estado = plantilla.columnas.find((c) => c.encabezado === 'Sitios On air')
    expect(estado?.etapa).toBe('On Air')
    expect(estado?.rol).toBe('estado')
    expect(plantilla.columnas.find((c) => c.encabezado === 'Fecha Sitio On Air')?.etapa).toBe(
      'On Air',
    )
  })

  it('la plantilla guardada lleva el tipo de cada etapa', () => {
    const p = construirPlantilla(plantilla, {
      id: 'x',
      nombre: 'x',
      descripcion: '',
      version: 1,
      homologacion: {},
    })
    expect(p.gates.find((g) => g.codigo === 'FC')?.tipo).toBe('paralela')
    expect(p.gates.find((g) => g.codigo === 'TSS')?.tipo).toBe('secuencial')
    // El estado consolidado de una etapa sin disciplinas es su unico registro:
    // se guarda como campo. El de cada disciplina viaja en su revision.
    const ids = p.campos.map((c) => c.id)
    expect(ids).toContain('status-fc')
    expect(ids).toContain('status-tss')
    expect(ids).not.toContain('status-tss-rf')
  })
})

describe('etapa actual con requisitos paralelos', () => {
  it('un FC pendiente o un contrato sin firmar no dejan al sitio "en FC"', () => {
    // Era el problema del tracker real: 1.169 de 1.388 sitios quedaban en FC.
    const { convertir } = armar([fila('A', APROBADO_HASTA_ING)])
    const f = convertir(0)
    expect(f.etapaActual).toBe('CONSTRUCCION')
    expect(avanceFueraDeOrden(f)).toEqual([])
  })

  it('un sitio On Air con todo cerrado sale del flujo', () => {
    const { convertir } = armar([fila('A', ON_AIR)])
    expect(convertir(0).etapaActual).toBe('CERRADO')
  })

  it('la fecha de On Air basta para cerrar la etapa', () => {
    const { convertir } = armar([fila('A', { ...ON_AIR, 'Sitios On air': null })])
    const f = convertir(0)
    const onAir = f.etapas.find((e) => e.codigo === 'ON_AIR')
    expect(onAir?.cerrada).toBe(true)
    expect(onAir?.fecha).toBe('2024-08-29')
  })

  it('el "0" de una formula no cierra la construccion', () => {
    const { convertir } = armar([fila('A', { ...APROBADO_HASTA_ING, 'Estado OOCC': 0 })])
    expect(convertir(0).etapaActual).toBe('CONSTRUCCION')
  })

  it('el fuera de orden solo mira las etapas secuenciales', () => {
    const { convertir } = armar([
      fila('A', { ...ON_AIR, 'Estado OOCC': '0', 'Status FC': 'Pendiente FC' }),
    ])
    const f = convertir(0)
    expect(f.etapaActual).toBe('CONSTRUCCION')
    expect(avanceFueraDeOrden(f)).toEqual(['AS_BUILT', 'ON_AIR'])
  })

  it('primeraAbierta salta las paralelas', () => {
    const e = (codigo: string, cerrada: boolean, tipo?: 'paralela') => ({
      codigo,
      ...(tipo ? { tipo } : {}),
      resumen: 'aprobado' as const,
      consolidado: null,
      cerrada,
      fecha: null,
      revisiones: {},
    })
    expect(primeraAbierta([e('A', true), e('FC', false, 'paralela'), e('B', false)])).toBe('B')
    expect(primeraAbierta([e('A', true), e('FC', false, 'paralela')])).toBe('CERRADO')
  })

  it('en un proyecto 5G un aprobado solo 4G no cierra la etapa', () => {
    const { convertir } = armar([
      fila('A', {
        ...APROBADO_HASTA_ING,
        Proyecto: '5G',
        'Status TSS': 'TSS Aprobado 4G',
        'Status Ing': 'Ing No Recibida 4G',
      }),
      fila('B', {
        ...APROBADO_HASTA_ING,
        Proyecto: '5G',
        'Status TSS': 'TSS Aprobado',
        'Status Ing': 'Ing Aprobada 4G/5G',
      }),
    ])
    expect(convertir(0).etapaActual).toBe('TSS')
    expect(convertir(1).etapaActual).toBe('CONSTRUCCION')
  })

  it('la cadena de siguiente salta las paralelas y las paralelas no tienen siguiente', () => {
    const { convertir } = armar([fila('A', APROBADO_HASTA_ING)])
    const gates = construirGates(convertir(0), { responsableUid: null, proveedorId: null })
    expect(gates.TSS?.siguiente).toBe('INGENIERIA')
    expect(gates.INGENIERIA?.siguiente).toBe('CONSTRUCCION')
    expect(gates.AS_BUILT?.siguiente).toBe('ON_AIR')
    expect(gates.ON_AIR?.siguiente).toBeNull()
    expect(gates.FC?.siguiente).toBeNull()
    expect(gates.FC?.tipo).toBe('paralela')
    expect(gates.FC?.estado).toBe('en_curso')
    expect(gates.CONSTRUCCION?.estado).toBe('en_curso')
  })
})

describe('condicionDelSitio', () => {
  it('lee la vigencia', () => {
    expect(condicionDelSitio('Vigente', 'Fase 1').vigente).toBe(true)
    expect(condicionDelSitio('No Vigente', 'Fase 1').vigente).toBe(false)
    expect(condicionDelSitio('', '').vigente).toBe(true)
  })

  it('separa el On Hold de la fase y lo convierte en bloqueo', () => {
    expect(condicionDelSitio('Vigente', 'Fase 2 - On Hold RF')).toEqual({
      vigente: true,
      bloqueado: true,
      motivoBloqueo: 'On Hold RF (tracker)',
      fase: 'Fase 2 - On Hold RF',
    })
    expect(condicionDelSitio('Vigente', 'On Hold - Localidades').motivoBloqueo).toBe(
      'On Hold Localidades (tracker)',
    )
    expect(condicionDelSitio('Vigente', 'Fase 2-On Hold').motivoBloqueo).toBe('On Hold (tracker)')
    expect(condicionDelSitio('Vigente', 'Fase 1').bloqueado).toBe(false)
  })

  it('eliminado o fuera de plan deja al sitio no vigente', () => {
    expect(condicionDelSitio('Vigente', 'Fase 1 - Eliminado').vigente).toBe(false)
    expect(condicionDelSitio('Vigente', 'Sale de Plan (RF)').vigente).toBe(false)
    expect(condicionDelSitio('Vigente', '5G - Implementado en 26GHZ').vigente).toBe(true)
  })
})

describe('estadoSitio', () => {
  const caso = (celdas: Celdas) => {
    const { convertir } = armar([fila('A', celdas)])
    return estadoSitio(convertir(0))
  }

  it('reproduce la homologacion del Excel por reglas', () => {
    expect(caso({ ...APROBADO_HASTA_ING, Vigencia: 'No Vigente' }).estado).toBe('no_vigente')
    expect(
      caso({ ...APROBADO_HASTA_ING, 'Status TSS': 'TSS Observado', 'Status Ing': 'Ing Aprobada' })
        .estado,
    ).toBe('en_tss')
    expect(caso({ ...APROBADO_HASTA_ING, 'Status Ing': 'Ing No Recibida' }).estado).toBe(
      'en_ingenieria',
    )
    expect(caso(APROBADO_HASTA_ING).estado).toBe('en_construccion')
    expect(
      caso({ ...ON_AIR, 'Status IPRAN': null, 'Sitios On air': null, 'Fecha Sitio On Air': null })
        .estado,
    ).toBe('recibido')
    expect(caso({ ...ON_AIR, 'Sitios On air': null, 'Fecha Sitio On Air': null }).estado).toBe(
      'recibido_tx_ok',
    )
    expect(caso(ON_AIR)).toEqual({ estado: 'on_air', tecnologia: '4G' })
  })

  it('lee el texto del Excel sin la tecnologia', () => {
    expect(estadoSitioDesdeTexto('En Etapa de Ingeniería 4G/5G')).toBe('en_ingenieria')
    expect(estadoSitioDesdeTexto('Recibido Con Tx OK 4G')).toBe('recibido_tx_ok')
    expect(estadoSitioDesdeTexto('Sitio Recibido 4G/5G')).toBe('recibido')
    expect(estadoSitioDesdeTexto('En Etapa de Construcción 4G')).toBe('en_construccion')
    expect(estadoSitioDesdeTexto('No Vigente')).toBe('no_vigente')
    expect(estadoSitioDesdeTexto('Sitio 4G/5G')).toBeNull()
  })

  it('reconoce cada hito por el nombre o el codigo de la etapa', () => {
    expect(hitoDeEtapa('AS_BUILT')).toBe('as_built')
    expect(hitoDeEtapa('Ingeniería')).toBe('ingenieria')
    expect(hitoDeEtapa('ON_AIR')).toBe('on_air')
    expect(hitoDeEtapa('Construcción')).toBe('construccion')
    expect(hitoDeEtapa('Contrato')).toBeNull()
  })
})

describe('resumirCalidad', () => {
  it('cuenta lo interpretado y compara con el Status Sitio', () => {
    const filas = [
      fila('A', ON_AIR),
      // El Excel se quedo en construccion con el As Built ya aprobado.
      fila('B', {
        ...ON_AIR,
        'Sitios On air': null,
        'Fecha Sitio On Air': null,
        'Status IPRAN': null,
        'Status Sitio': 'En Construcción 4G',
      }),
      fila('C', { ...APROBADO_HASTA_ING, 'Estado OOCC': 'Finaliazada', 'Estado OOEE': 0 }),
      fila('D', { ...APROBADO_HASTA_ING, Proyecto: 'Fase 2 - On Hold', Vigencia: 'No Vigente' }),
    ]
    const { plantilla } = armar(filas)
    const indice = indexarColumnas(plantilla)
    const r = resumirCalidad(filas.map((f) => convertirFila(f, plantilla, indice)))
    expect(r.filas).toBe(4)
    expect(r.corregidas).toBe(1)
    expect(r.ceros).toBe(1)
    expect(r.noVigentes).toBe(1)
    expect(r.enHold).toBe(1)
    expect(r.comparables).toBe(2)
    expect(r.coincidencias).toBe(1)
    expect(r.porTipo.trackerAtrasado).toBe(1)
    expect(r.ejemplos[0]).toMatchObject({ sitioId: 'B', derivado: 'recibido' })
  })

  it('clasifica el tipo de desacuerdo', () => {
    expect(tipoDiscrepancia('en_construccion', 'recibido')).toBe('trackerAtrasado')
    expect(tipoDiscrepancia('on_air', 'en_tss')).toBe('trackerAdelantado')
    expect(tipoDiscrepancia('en_tss', 'no_vigente')).toBe('vigencia')
  })
})
