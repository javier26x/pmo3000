import { describe, expect, it } from 'vitest'
import {
  avanceDeEtapa,
  clasificarEstado,
  combinarTecnologias,
  corregirErratas,
  esFechaDeEstado,
  estaCerrado,
  estadoResumen,
  normalizarTexto,
  pideAccion,
  tecnologiaDe,
} from './estados'

describe('tecnologiaDe', () => {
  it('separa la tecnologia del estado', () => {
    expect(tecnologiaDe('Ing Aprobada 4G')).toBe('4G')
    expect(tecnologiaDe('Ing Aprobada 4G/5G')).toBe('4G/5G')
    expect(tecnologiaDe('Ing Aprobada 4G/ 5G')).toBe('4G/5G')
    expect(tecnologiaDe('Ing Aprobada 4G/ Ing 5G En Revisión')).toBe('4G/5G')
    expect(tecnologiaDe('5G - Implementado en 26GHZ')).toBe('5G')
    expect(tecnologiaDe('TSS Aprobado Indoor')).toBe('Indoor')
    expect(tecnologiaDe('TSS Aprobado')).toBeNull()
    expect(tecnologiaDe(null)).toBeNull()
  })

  it('en un sitio manda la tecnologia mas amplia', () => {
    expect(combinarTecnologias(['4G', '4G/5G', null])).toBe('4G/5G')
    expect(combinarTecnologias(['4G', '5G'])).toBe('4G/5G')
    expect(combinarTecnologias(['Indoor', '4G'])).toBe('4G')
    expect(combinarTecnologias(['Indoor', null])).toBe('Indoor')
    expect(combinarTecnologias([null])).toBeNull()
  })
})

describe('clasificarEstado', () => {
  it('reconoce las variantes de redaccion del mismo estado', () => {
    // Las seis salen tal cual de las columnas Status TSS RF de los trackers.
    for (const texto of [
      'TSS Aprobado',
      'TSS aprobado',
      'TSs Aprobado',
      'TSS Aprobado Indoor',
      'TSS Aprobado 4G',
      'Ing Aprobada',
    ]) {
      expect(clasificarEstado(texto)).toBe('aprobado')
    }
  })

  it('separa el aprobado limpio del aprobado con peros', () => {
    expect(clasificarEstado('TSS Aprobado')).toBe('aprobado')
    expect(clasificarEstado('TSS Aprobado con Observaciones')).toBe('aprobado_con_obs')
    expect(clasificarEstado('Ing Aprobada con OBS')).toBe('aprobado_con_obs')
    expect(clasificarEstado('TSS Aprobado (Adm)')).toBe('aprobado_con_obs')
  })

  it('no confunde observado con aprobado con observaciones', () => {
    expect(clasificarEstado('Ing Observada')).toBe('observado')
    expect(clasificarEstado('As Built Observado')).toBe('observado')
  })

  it('no lee "no recibido" como recibido', () => {
    expect(clasificarEstado('TSS No Recibido')).toBe('no_recibido')
    expect(clasificarEstado('Ing No Recibida')).toBe('no_recibido')
    expect(clasificarEstado('As Built No Recibido')).toBe('no_recibido')
    expect(clasificarEstado('FC No Enviado a OOII')).toBe('no_recibido')
  })

  it('entiende que el FC enviado a OOII es el FC hecho', () => {
    // Antes esto se leia como "en revision". En el tracker Outdoor "FC Enviado
    // a OOII" es el estado final del FC (1.019 sitios); lo pendiente se escribe
    // "Pendiente FC" o "FC No Enviado".
    expect(clasificarEstado('FC Enviado a OOII')).toBe('aprobado')
    expect(clasificarEstado('FC Entregado a OOII')).toBe('aprobado')
    expect(clasificarEstado('FC Enviado OOII')).toBe('aprobado')
    expect(clasificarEstado('Pendiente FC')).toBe('no_recibido')
    expect(clasificarEstado('FC No Enviado')).toBe('no_recibido')
  })

  it('clasifica la etapa declarada del sitio como trabajo en curso', () => {
    expect(clasificarEstado('En Etapa de TSS 4G')).toBe('en_revision')
    expect(clasificarEstado('En Implementación 4G')).toBe('en_revision')
  })

  it('trata la celda vacia como no recibido, no como desconocido', () => {
    expect(clasificarEstado('')).toBe('no_recibido')
    expect(clasificarEstado('   ')).toBe('no_recibido')
    expect(clasificarEstado(null)).toBe('no_recibido')
    expect(clasificarEstado(undefined)).toBe('no_recibido')
  })

  it('reconoce lo que no corresponde', () => {
    expect(clasificarEstado('No Aplica')).toBe('no_aplica')
    expect(clasificarEstado('no aplica')).toBe('no_aplica')
    expect(clasificarEstado('-')).toBe('no_aplica')
    expect(clasificarEstado('No')).toBe('no_aplica')
  })

  it('admite que no sabe en vez de inventar', () => {
    // Vocabulario propio del negocio. Que caiga en desconocido es el
    // comportamiento correcto: la app lo muestra para que alguien lo homologue.
    expect(clasificarEstado('TDI')).toBe('desconocido')
    expect(clasificarEstado('Poste')).toBe('desconocido')
  })

  it('el contrato post RFI esta diferido, no pendiente', () => {
    // Antes caia en desconocido. Es un acuerdo: el contrato se firma despues
    // del RFI, asi que hoy no falta nada.
    expect(clasificarEstado('Contrato Post RFI')).toBe('no_aplica')
    expect(clasificarEstado('Contrato Firmado')).toBe('aprobado')
    expect(clasificarEstado('Contrato No Firmado')).toBe('no_recibido')
  })

  it('"0" es falta de dato, no "no aplica"', () => {
    // Es lo que deja una formula sobre una celda vacia: 362 celdas de "Estado
    // OOCC" en el tracker Outdoor. Leerlo como cerrado daba obras por hechas.
    expect(clasificarEstado('0')).toBe('no_recibido')
    expect(clasificarEstado('-')).toBe('no_aplica')
    expect(clasificarEstado('No aplica')).toBe('no_aplica')
  })

  it('corrige las erratas reales antes de clasificar', () => {
    expect(clasificarEstado('Finaliazada')).toBe('aprobado')
    expect(clasificarEstado('Termnaida')).toBe('aprobado')
    expect(clasificarEstado('Finalaizado')).toBe('aprobado')
    expect(clasificarEstado('Finallizadas')).toBe('aprobado')
    expect(clasificarEstado('Ing Apobada')).toBe('aprobado')
    expect(clasificarEstado('In Aprobada')).toBe('aprobado')
    expect(clasificarEstado('TSs Aprobado')).toBe('aprobado')
    expect(clasificarEstado('As Built Rachazado')).toBe('rechazado')
    expect(clasificarEstado('FC Emviado a OOII')).toBe('aprobado')
    expect(clasificarEstado('Starlink Instadado')).toBe('aprobado')
    expect(clasificarEstado('As Bult En Revisión')).toBe('en_revision')
    expect(clasificarEstado('TSS Aprobado con Obervaciones')).toBe('aprobado_con_obs')
    expect(clasificarEstado('As Built Aprobado Con Observaciobes')).toBe('aprobado_con_obs')
  })

  it('no corrige de mas', () => {
    // Un infinitivo es un pendiente, no una errata del participio.
    expect(corregirErratas('por integrar').correcciones).toBe(0)
    expect(corregirErratas('revisar').correcciones).toBe(0)
    expect(corregirErratas('tss aprobado').correcciones).toBe(0)
    expect(corregirErratas('finaliazada')).toEqual({ texto: 'finalizada', correcciones: 1 })
  })

  it('una fecha en una celda de estado dice que la cosa ocurrio', () => {
    expect(clasificarEstado(new Date(Date.UTC(2025, 8, 3)))).toBe('aprobado')
    expect(clasificarEstado('2025-09-03')).toBe('aprobado')
    expect(clasificarEstado('03-09-2025')).toBe('aprobado')
    expect(clasificarEstado('Wed Sep 03 2025 00:00:00 GMT-0400 (hora estándar de Chile)')).toBe(
      'aprobado',
    )
    expect(esFechaDeEstado('TSS Aprobado 2025')).toBe(false)
  })

  it('entiende el vocabulario de obras, energia y transmision', () => {
    expect(clasificarEstado('Energia Provisoria')).toBe('en_revision')
    expect(clasificarEstado('Revisar')).toBe('en_revision')
    expect(clasificarEstado('En Diseño')).toBe('en_revision')
    expect(clasificarEstado('PreFactibilidad Ing MMOO')).toBe('en_revision')
    expect(clasificarEstado('Espera OC')).toBe('no_recibido')
    expect(clasificarEstado('Starlink')).toBe('aprobado')
    expect(clasificarEstado('Integrado')).toBe('aprobado')
    expect(clasificarEstado('No Iniciadas')).toBe('no_recibido')
    expect(clasificarEstado('En Ejecución')).toBe('en_revision')
    expect(clasificarEstado('Sin Energía Provisoria')).toBe('no_recibido')
  })

  it('la homologacion de la plantilla manda sobre la heuristica', () => {
    const tabla = { 'Contrato Post RFI': 'aprobado_con_obs', 'TSS Aprobado': 'observado' } as const
    expect(clasificarEstado('Contrato Post RFI', tabla)).toBe('aprobado_con_obs')
    expect(clasificarEstado('TSS Aprobado', tabla)).toBe('observado')
  })

  it('la homologacion compara sin importar tildes ni mayusculas', () => {
    const tabla = { 'energia definitiva entrega ll': 'aprobado' } as const
    expect(clasificarEstado('Energía Definitiva Entrega LL', tabla)).toBe('aprobado')
  })
})

describe('normalizarTexto', () => {
  it('quita tildes, baja a minusculas y colapsa espacios', () => {
    expect(normalizarTexto('  Ingeniería   APROBADA ')).toBe('ingenieria aprobada')
  })
})

describe('estaCerrado y pideAccion', () => {
  it('lo aprobado y lo que no aplica dejan avanzar', () => {
    expect(estaCerrado('aprobado')).toBe(true)
    expect(estaCerrado('aprobado_con_obs')).toBe(true)
    expect(estaCerrado('no_aplica')).toBe(true)
    expect(estaCerrado('observado')).toBe(false)
    expect(estaCerrado('en_revision')).toBe(false)
  })

  it('lo que pide accion es lo que alguien tiene que destrabar', () => {
    expect(pideAccion('observado')).toBe(true)
    expect(pideAccion('rechazado')).toBe(true)
    expect(pideAccion('detenido')).toBe(true)
    expect(pideAccion('no_recibido')).toBe(false)
  })
})

describe('avanceDeEtapa', () => {
  it('todo aprobado es 1 y nada recibido es 0', () => {
    expect(avanceDeEtapa(['aprobado', 'aprobado', 'aprobado'])).toBe(1)
    expect(avanceDeEtapa(['no_recibido', 'no_recibido'])).toBe(0)
  })

  it('lo que no aplica sale del divisor', () => {
    // Dos aprobadas y una que no corresponde es una etapa completa, no 2/3.
    expect(avanceDeEtapa(['aprobado', 'aprobado', 'no_aplica'])).toBe(1)
  })

  it('una etapa entera que no aplica esta completa', () => {
    expect(avanceDeEtapa(['no_aplica', 'no_aplica'])).toBe(1)
  })

  it('sin revisiones no hay avance que calcular', () => {
    expect(avanceDeEtapa([])).toBe(0)
  })

  it('el aprobado con peros vale casi lo mismo, pero no lo mismo', () => {
    expect(avanceDeEtapa(['aprobado_con_obs'])).toBeCloseTo(0.9)
    expect(avanceDeEtapa(['aprobado_con_obs'])).toBeLessThan(avanceDeEtapa(['aprobado']))
  })
})

describe('estadoResumen', () => {
  it('un rechazo manda sobre el resto', () => {
    expect(estadoResumen(['aprobado', 'aprobado', 'rechazado'])).toBe('rechazado')
  })

  it('una observacion pendiente se ve aunque casi todo este aprobado', () => {
    expect(estadoResumen(['aprobado', 'aprobado', 'observado'])).toBe('observado')
  })

  it('todas aprobadas resume en aprobado', () => {
    expect(estadoResumen(['aprobado', 'aprobado'])).toBe('aprobado')
  })

  it('si alguna tiene peros, el resumen los arrastra', () => {
    expect(estadoResumen(['aprobado', 'aprobado_con_obs'])).toBe('aprobado_con_obs')
  })

  it('con algo avanzado y algo sin llegar, la etapa esta en curso', () => {
    expect(estadoResumen(['aprobado', 'no_recibido'])).toBe('en_revision')
    expect(estadoResumen(['en_revision', 'no_recibido'])).toBe('en_revision')
  })

  it('nada recibido resume en no recibido', () => {
    expect(estadoResumen(['no_recibido', 'no_recibido'])).toBe('no_recibido')
  })

  it('una etapa que entera no aplica no pide nada', () => {
    expect(estadoResumen(['no_aplica', 'no_aplica'])).toBe('no_aplica')
  })
})
