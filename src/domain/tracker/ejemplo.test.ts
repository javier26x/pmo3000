import { describe, expect, it } from 'vitest'
import { filasTrackerEjemplo } from './ejemplo'
import { inferirPlantilla } from './inferencia'
import { convertirFila, indexarColumnas } from './aplicacion'

/**
 * El ejemplo que se descarga tiene que importarse limpio: si la inferencia
 * cambia y deja de reconocerlo, quien parte de cero se encuentra con una
 * planilla nuestra que nuestra propia app lee mal.
 */
describe('tracker de ejemplo', () => {
  const filas = filasTrackerEjemplo()
  const p = inferirPlantilla(filas)
  const indice = indexarColumnas(p)
  const porId = new Map(
    filas.slice(1).map((f) => {
      const r = convertirFila(f, p, indice)
      return [r.sitio.id, r]
    }),
  )

  it('se importa sin avisos y encuentra la identidad del sitio', () => {
    expect(p.avisos).toEqual([])
    expect(p.identidad.id).toBe(0)
    expect(p.identidad.nombre).toBe(1)
    expect(p.identidad.lat).not.toBeNull()
  })

  it('deduce el proceso completo con sus disciplinas', () => {
    expect(p.etapas.map((e) => e.nombre)).toEqual([
      'TSS',
      'Ingeniería',
      'Construcción',
      'As Built',
      'Contrato',
      'On Air',
    ])
    expect(p.etapas[0]!.revisiones.map((r) => r.nombre)).toEqual(['RF', 'ECE'])
    expect(p.etapas[1]!.revisiones.map((r) => r.nombre)).toEqual(['RF', 'OOCC'])
    expect(p.etapas.find((e) => e.nombre === 'Contrato')?.tipo).toBe('paralela')
  })

  it('todas las celdas calzan con el tipo propuesto', () => {
    expect(p.columnas.filter((c) => c.noConvertibles > 0)).toEqual([])
  })

  it('ningun estado queda sin clasificar', () => {
    for (const fila of porId.values()) {
      expect(fila.problemas).toEqual([])
      expect(fila.etapas.filter((e) => e.resumen === 'desconocido').map((e) => e.nombre)).toEqual(
        [],
      )
    }
  })

  it('cada sitio queda en la etapa que muestra', () => {
    const actual = (id: string) => porId.get(id)?.etapaActual
    expect(actual('EJ_001')).toBe('CERRADO')
    expect(actual('EJ_002')).toBe('AS_BUILT')
    expect(actual('EJ_003')).toBe('CONSTRUCCION')
    expect(actual('EJ_004')).toBe('INGENIERIA')
    expect(actual('EJ_007')).toBe('TSS')
  })

  it('trae un sitio en espera y uno fuera del plan', () => {
    expect(porId.get('EJ_008')?.condicion?.bloqueado).toBe(true)
    expect(porId.get('EJ_009')?.condicion?.vigente).toBe(false)
  })
})
