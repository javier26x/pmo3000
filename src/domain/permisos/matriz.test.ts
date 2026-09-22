import { describe, expect, it } from 'vitest'
import { ROLES } from '@/domain/tipos/comunes'
import { filtroObligatorio, puede, tieneVisibilidadParcial } from './matriz'

describe('puede', () => {
  it('el admin puede todo', () => {
    expect(puede('admin', 'usuarios', 'editar')).toBe(true)
    expect(puede('admin', 'gateTemplates', 'editar')).toBe(true)
    expect(puede('admin', 'sitioProyectos', 'retrocederGate')).toBe(true)
  })

  it('el lector solo lee', () => {
    expect(puede('lector', 'sitios', 'ver')).toBe(true)
    expect(puede('lector', 'sitios', 'editar')).toBe(false)
    expect(puede('lector', 'sitioProyectos', 'editarChecklist')).toBe(false)
    expect(puede('lector', 'tareas', 'crear')).toBe(false)
  })

  it('el analista avanza gates pero no retrocede', () => {
    expect(puede('analista', 'sitioProyectos', 'avanzarGate')).toBe(true)
    expect(puede('analista', 'sitioProyectos', 'retrocederGate')).toBe(false)
  })

  it('el contratista reporta avance pero no aprueba el gate', () => {
    expect(puede('contratista', 'sitioProyectos', 'editarChecklist')).toBe(true)
    expect(puede('contratista', 'sitioProyectos', 'registrarFechaReal')).toBe(true)
    expect(puede('contratista', 'sitioProyectos', 'avanzarGate')).toBe(false)
    expect(puede('contratista', 'sitios', 'importar')).toBe(false)
    expect(puede('contratista', 'auditoria', 'ver')).toBe(false)
  })

  it('nadie salvo el admin administra usuarios', () => {
    for (const rol of ROLES) {
      if (rol === 'admin') continue
      expect(puede(rol, 'usuarios', 'editar')).toBe(false)
    }
  })
})

describe('filtroObligatorio', () => {
  it('acota al contratista a su proveedor', () => {
    expect(filtroObligatorio({ rol: 'contratista', proveedorId: 'prov-alfa' })).toEqual({
      campo: 'proveedorId',
      valor: 'prov-alfa',
    })
  })

  it('no filtra a los roles internos', () => {
    expect(filtroObligatorio({ rol: 'analista', proveedorId: null })).toBeNull()
    expect(filtroObligatorio({ rol: 'admin', proveedorId: null })).toBeNull()
  })

  it('falla ruidosamente si un contratista no tiene proveedor', () => {
    // Preferimos un error visible a una consulta que devuelva el despliegue completo.
    expect(() => filtroObligatorio({ rol: 'contratista', proveedorId: null })).toThrow()
  })
})

describe('tieneVisibilidadParcial', () => {
  it('solo el contratista ve un subconjunto', () => {
    expect(tieneVisibilidadParcial('contratista')).toBe(true)
    expect(tieneVisibilidadParcial('analista')).toBe(false)
  })
})
