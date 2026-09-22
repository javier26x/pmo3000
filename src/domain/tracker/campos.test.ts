import { describe, expect, it } from 'vitest'
import {
  coercionar,
  comparar,
  esCentinelaDeSemana,
  formatearValor,
  idDeEncabezado,
  idUnico,
  normalizarSemana,
  semanaDeFecha,
} from './campos'

describe('idDeEncabezado', () => {
  it('sobrevive a tildes, mayusculas y espacios de mas', () => {
    expect(idDeEncabezado('  Status TSS  RF ')).toBe('status-tss-rf')
    expect(idDeEncabezado('Presentación Ingeniería')).toBe('presentacion-ingenieria')
  })

  it('da el mismo id aunque alguien corrija un espacio en la planilla', () => {
    // Si el id cambiara, la reimportacion crearia un campo nuevo en vez de
    // actualizar el que ya existe.
    expect(idDeEncabezado('Fecha Máxima Respuesta')).toBe(idDeEncabezado('fecha maxima  respuesta'))
  })

  it('nunca devuelve vacio', () => {
    expect(idDeEncabezado('   ')).toBe('campo')
    expect(idDeEncabezado('///')).toBe('campo')
  })
})

describe('idUnico', () => {
  it('desempata encabezados que se normalizan igual', () => {
    const tomados = new Set(['fecha'])
    expect(idUnico('Fecha', tomados)).toBe('fecha-2')
  })
})

describe('normalizarSemana', () => {
  it('acepta las cuatro formas que usan los trackers', () => {
    expect(normalizarSemana('W37 2024')).toBe('2024-W37')
    expect(normalizarSemana('W34-2026')).toBe('2026-W34')
    expect(normalizarSemana('2024-W26')).toBe('2024-W26')
    expect(normalizarSemana('w12-2024')).toBe('2024-W12')
  })

  it('ordena cronologicamente como texto', () => {
    const semanas = ['W40 2024', 'W02 2025', 'W09 2024'].map((s) => normalizarSemana(s)!)
    expect([...semanas].sort()).toEqual(['2024-W09', '2024-W40', '2025-W02'])
  })

  it('rechaza el centinela que produce Excel sobre una fecha vacia', () => {
    expect(normalizarSemana('W52 1900')).toBeNull()
    expect(esCentinelaDeSemana('W52 1900')).toBe(true)
    expect(esCentinelaDeSemana('W52 2024')).toBe(false)
  })

  it('rechaza semanas imposibles', () => {
    expect(normalizarSemana('W61 2024')).toBeNull()
    expect(normalizarSemana('W00 2024')).toBeNull()
  })
})

describe('semanaDeFecha', () => {
  it('usa la norma ISO: la semana es del ano de su jueves', () => {
    // El 1 de enero de 2026 es jueves, asi que esa semana es la W01 de 2026.
    expect(semanaDeFecha('2026-01-01')).toBe('2026-W01')
    // El 31 de diciembre de 2024 es martes: su jueves cae en 2025.
    expect(semanaDeFecha('2024-12-31')).toBe('2025-W01')
  })
})

describe('coercionar', () => {
  it('la celda vacia es null en cualquier tipo, sin error', () => {
    for (const tipo of ['texto', 'numero', 'fecha', 'semana', 'booleano'] as const) {
      expect(coercionar(tipo, '')).toEqual({ ok: true, valor: null })
      expect(coercionar(tipo, null)).toEqual({ ok: true, valor: null })
    }
  })

  it('lee numeros con formato chileno', () => {
    expect(coercionar('numero', '1.234,5')).toEqual({ ok: true, valor: 1234.5 })
    expect(coercionar('numero', 24)).toEqual({ ok: true, valor: 24 })
  })

  it('avisa en vez de tragarse lo que no puede convertir', () => {
    const r = coercionar('numero', 'veinticuatro')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('veinticuatro')
  })

  it('deriva la semana de una fecha cuando la columna trae la fecha', () => {
    expect(coercionar('semana', new Date(Date.UTC(2026, 0, 1)))).toEqual({
      ok: true,
      valor: '2026-W01',
    })
  })

  it('el centinela de semana entra como vacio, no como error', () => {
    // Si contara como error, el informe de importacion se llenaria de falsas
    // alarmas: hay cientos de estas celdas en un tracker real.
    expect(coercionar('semana', 'W52 1900')).toEqual({ ok: true, valor: null })
  })

  it('guarda el estado con su texto original', () => {
    // La clasificacion se calcula al leer, con la homologacion de la plantilla,
    // que puede cambiar despues sin tener que reimportar nada.
    expect(coercionar('estado', ' TSS Aprobado con Observaciones ')).toEqual({
      ok: true,
      valor: 'TSS Aprobado con Observaciones',
    })
  })

  it('entiende los si y los no como se escriben en planilla', () => {
    expect(coercionar('booleano', 'Si')).toEqual({ ok: true, valor: true })
    expect(coercionar('booleano', 'X')).toEqual({ ok: true, valor: true })
    expect(coercionar('booleano', 'No')).toEqual({ ok: true, valor: false })
    expect(coercionar('booleano', 'quizas').ok).toBe(false)
  })
})

describe('formatearValor', () => {
  it('muestra las fechas en formato chileno', () => {
    expect(formatearValor('fecha', '2026-03-09')).toBe('09-03-2026')
  })

  it('muestra la semana como la escribe la PMO', () => {
    expect(formatearValor('semana', '2026-W34')).toBe('W34-2026')
  })

  it('el vacio se ve vacio, no como "null"', () => {
    expect(formatearValor('texto', null)).toBe('')
    expect(formatearValor('numero', null)).toBe('')
  })
})

describe('comparar', () => {
  it('los vacios van al final, ordene como ordene', () => {
    expect(comparar('texto', null, 'a')).toBeGreaterThan(0)
    expect(comparar('texto', 'a', null)).toBeLessThan(0)
  })

  it('los numeros se comparan como numeros, no como texto', () => {
    expect(comparar('numero', 9, 10)).toBeLessThan(0)
  })

  it('fechas y semanas ordenan cronologicamente', () => {
    expect(comparar('fecha', '2026-01-09', '2026-01-10')).toBeLessThan(0)
    expect(comparar('semana', '2024-W40', '2025-W02')).toBeLessThan(0)
  })
})
