import { describe, expect, it } from 'vitest'
import { leerHojaCruda, libroTrackerEjemplo } from './archivos'
import { filasTrackerEjemplo } from '@/domain/tracker/ejemplo'
import { inferirPlantilla } from '@/domain/tracker/inferencia'

describe('libroTrackerEjemplo', () => {
  it('al volver a subirlo se elige la hoja del tracker y se lee igual', async () => {
    const archivo = new File([await libroTrackerEjemplo()], 'ejemplo.xlsx')
    const crudo = await leerHojaCruda(archivo)

    expect(crudo.hojas).toEqual(['Tracker', 'Instrucciones'])
    expect(crudo.hoja).toBe('Tracker')
    expect(crudo.filas).toHaveLength(filasTrackerEjemplo().length)

    const p = inferirPlantilla(crudo.filas)
    expect(p.avisos).toEqual([])
    expect(p.etapas).toHaveLength(6)
    expect(p.columnas.filter((c) => c.noConvertibles > 0)).toEqual([])
  })
})
