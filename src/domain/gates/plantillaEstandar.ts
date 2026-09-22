/**
 * Plantilla estandar de gates del despliegue. Es un dato de configuracion (vive
 * en la coleccion gateTemplates y es editable), no codigo: esto es solo la
 * semilla con la que arranca una instalacion nueva.
 */
import type { GatePlantilla, GateTemplate } from '@/domain/tipos/gate'

function item(id: string, texto: string, obligatorio = true, requiereEvidencia = false) {
  return { id, texto, obligatorio, requiereEvidencia }
}

export const GATES_ESTANDAR: GatePlantilla[] = [
  {
    codigo: 'TSSR',
    nombre: 'TSSR',
    orden: 0,
    slaDias: 15,
    checklist: [
      item('tssr-informe', 'Informe de survey tecnico firmado', true, true),
      item('tssr-fotos', 'Set fotografico del sitio (4 orientaciones)', true, true),
      item('tssr-coordenadas', 'Coordenadas validadas en terreno'),
      item('tssr-factibilidad', 'Factibilidad electrica confirmada'),
      item('tssr-croquis', 'Croquis de emplazamiento', false, false),
    ],
  },
  {
    codigo: 'FC',
    nombre: 'FC',
    orden: 1,
    slaDias: 45,
    checklist: [
      item('fc-obra', 'Obra civil terminada'),
      item('fc-gabinete', 'Gabinete o sala de equipos instalada'),
      item('fc-energia', 'Acometida electrica energizada'),
      item('fc-tierra', 'Medicion de malla de tierra conforme', true, true),
      item('fc-acta', 'Acta de recepcion de obra civil', true, true),
    ],
  },
  {
    codigo: 'RFI',
    nombre: 'RFI',
    orden: 2,
    slaDias: 10,
    checklist: [
      item('rfi-soporte', 'Soporte de antenas apto segun calculo de carga'),
      item('rfi-acceso', 'Acceso y llaves entregadas'),
      item('rfi-permiso', 'Permiso municipal vigente', true, true),
      item('rfi-transmision', 'Ruta de transmision disponible'),
    ],
  },
  {
    codigo: 'IMP',
    nombre: 'Implementacion',
    orden: 3,
    slaDias: 20,
    checklist: [
      item('imp-ran', 'Equipamiento RAN instalado'),
      item('imp-antenas', 'Antenas instaladas con azimut y tilt de diseno'),
      item('imp-transmision', 'Transmision integrada'),
      item('imp-vswr', 'Pruebas de VSWR conformes', true, true),
      item('imp-aire', 'Sitio en aire'),
    ],
  },
  {
    codigo: 'D1',
    nombre: 'D+1',
    orden: 4,
    slaDias: 1,
    checklist: [
      item('d1-disponibilidad', 'Disponibilidad sobre el umbral en las primeras 24 h'),
      item('d1-alarmas', 'Sin alarmas criticas abiertas'),
      item('d1-config', 'Checklist de configuracion validado'),
    ],
  },
  {
    codigo: 'D7',
    nombre: 'D+7',
    orden: 5,
    slaDias: 7,
    checklist: [
      item('d7-kpi', 'KPI estables durante 7 dias', true, true),
      item('d7-alarmas', 'Sin alarmas recurrentes'),
      item('d7-optimizacion', 'Ajustes de optimizacion aplicados', false, false),
    ],
  },
  {
    codigo: 'SSV',
    nombre: 'SSV',
    orden: 6,
    slaDias: 10,
    checklist: [
      item('ssv-drivetest', 'Drive test aprobado', true, true),
      item('ssv-acta', 'Acta SSV firmada por ambas partes', true, true),
      item('ssv-carpeta', 'Carpeta documental completa'),
      item('ssv-inventario', 'Inventario de activos actualizado'),
    ],
  },
]

export const ID_PLANTILLA_ESTANDAR = 'estandar-despliegue'

export const PLANTILLA_ESTANDAR: GateTemplate = {
  id: ID_PLANTILLA_ESTANDAR,
  nombre: 'Despliegue estandar',
  descripcion: 'Secuencia TSSR - FC - RFI - Implementacion - D+1 - D+7 - SSV.',
  version: 1,
  activo: true,
  gates: GATES_ESTANDAR,
  creadoEn: null,
  creadoPor: null,
  actualizadoEn: null,
  actualizadoPor: null,
}
