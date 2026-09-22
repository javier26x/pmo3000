/** Fabricas de objetos de dominio para los tests. No se usan en produccion. */
import { crearGatesDesdePlantilla } from '@/domain/gates/maquina'
import { PLANTILLA_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { Actor, Rol } from '@/domain/tipos/comunes'

export const plantilla: GateTemplate = PLANTILLA_ESTANDAR

export function actor(rol: Rol, extra: Partial<Actor> = {}): Actor {
  return {
    uid: `uid-${rol}`,
    email: `${rol}@clarovtr.cl`,
    nombre: `Usuario ${rol}`,
    rol,
    celulaId: 'celula-1',
    proveedorId: rol === 'contratista' ? 'prov-alfa' : null,
    alcance: { celulas: [], programas: [], proyectos: [] },
    ...extra,
  }
}

export function sitioProyecto(extra: Partial<SitioProyecto> = {}): SitioProyecto {
  const inicial = crearGatesDesdePlantilla(plantilla, {
    fechaInicio: '2026-01-01',
    responsableUid: 'uid-analista',
    proveedorId: 'prov-alfa',
  })

  return {
    id: 'proy-1__SITIO-0001',
    sitioId: 'SITIO-0001',
    proyectoId: 'proy-1',
    programaId: 'prog-1',
    portafolioId: 'port-1',
    celulaId: 'celula-1',
    proveedorId: 'prov-alfa',
    responsableUid: 'uid-analista',
    sitioNombre: 'Sitio Ficticio 1',
    region: 'Region Metropolitana',
    comuna: 'Maipu',
    lat: -33.5,
    lon: -70.76,
    gateActual: inicial.gateActual,
    estadoGate: inicial.estadoGate,
    bloqueado: false,
    motivoBloqueo: null,
    vigente: true,
    prioridad: 'media',
    fechaPlanGateActual: inicial.fechaPlanGateActual,
    gates: inicial.gates,
    pasos: null,
    valores: {},
    gateTemplateId: plantilla.id,
    gateTemplateVersion: plantilla.version,
    creadoEn: new Date('2026-01-01T12:00:00Z'),
    creadoPor: 'uid-analista',
    actualizadoEn: new Date('2026-01-01T12:00:00Z'),
    actualizadoPor: 'uid-analista',
    ...extra,
  }
}

/** Marca como cumplidos todos los entregables obligatorios de un gate. */
export function cumplirChecklist(sp: SitioProyecto, codigo: keyof typeof sp.gates): SitioProyecto {
  const gate = sp.gates[codigo]
  const definicion = plantilla.gates.find((g) => g.codigo === codigo)
  if (!gate || !definicion) return sp

  const checklist = { ...gate.checklist }
  for (const item of definicion.checklist) {
    checklist[item.id] = {
      ok: true,
      obs: '',
      evidenciaUrl: item.requiereEvidencia ? 'https://ejemplo.local/evidencia.pdf' : '',
      por: 'uid-analista',
      en: new Date('2026-01-05T12:00:00Z'),
    }
  }

  return { ...sp, gates: { ...sp.gates, [codigo]: { ...gate, checklist } } }
}
