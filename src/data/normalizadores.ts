import type { DocumentData } from 'firebase/firestore'
import {
  booleano,
  enumerado,
  enumeradoNulo,
  fechaISO,
  instante,
  listaTexto,
  numero,
  numeroNulo,
  objeto,
  sellos,
  texto,
  textoNulo,
} from './convertidores'
import {
  ACCIONES_AUDITORIA,
  ESTADOS_GATE,
  ESTADOS_PROGRAMA,
  ESTADOS_RAID,
  ESTADOS_TAREA,
  PRIORIDADES,
  ROLES,
  TIPOS_DEPENDENCIA,
  TIPOS_ENTIDAD,
  TIPOS_RAID,
  type Celula,
  type Dependencia,
  type EventoAuditoria,
  type GatePlantilla,
  type GateTemplate,
  type ItemPlantilla,
  type Portafolio,
  type Programa,
  type Proveedor,
  type Proyecto,
  type Raid,
  type Sitio,
  type Tarea,
  type Usuario,
} from '@/domain/tipos'
import type { GateSitio, ItemChecklist, SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { CERRADO, CODIGOS_GATE, esCodigoGate, type CodigoGate } from '@/domain/gates/catalogo'

export function normalizarUsuario(id: string, d: DocumentData): Usuario {
  return {
    id,
    email: texto(d.email).toLowerCase(),
    nombre: texto(d.nombre, texto(d.email)),
    rol: enumerado(d.rol, ROLES, 'lector'),
    celulaId: textoNulo(d.celulaId),
    proveedorId: textoNulo(d.proveedorId),
    activo: booleano(d.activo, true),
    ultimoAcceso: instante(d.ultimoAcceso),
    ...sellos(d),
  }
}

export function normalizarCelula(id: string, d: DocumentData): Celula {
  return {
    id,
    nombre: texto(d.nombre, id),
    descripcion: texto(d.descripcion),
    liderUid: textoNulo(d.liderUid),
    color: texto(d.color, 'neutro'),
    activa: booleano(d.activa, true),
    ...sellos(d),
  }
}

export function normalizarProveedor(id: string, d: DocumentData): Proveedor {
  return {
    id,
    nombre: texto(d.nombre, id),
    contactoNombre: texto(d.contactoNombre),
    contactoEmail: texto(d.contactoEmail),
    activo: booleano(d.activo, true),
    ...sellos(d),
  }
}

export function normalizarPortafolio(id: string, d: DocumentData): Portafolio {
  return {
    id,
    nombre: texto(d.nombre, id),
    descripcion: texto(d.descripcion),
    responsableUid: textoNulo(d.responsableUid),
    periodo: texto(d.periodo),
    activo: booleano(d.activo, true),
    ...sellos(d),
  }
}

export function normalizarPrograma(id: string, d: DocumentData): Programa {
  return {
    id,
    portafolioId: texto(d.portafolioId),
    nombre: texto(d.nombre, id),
    descripcion: texto(d.descripcion),
    gateTemplateId: texto(d.gateTemplateId, 'estandar-despliegue'),
    fechaInicio: fechaISO(d.fechaInicio),
    fechaFin: fechaISO(d.fechaFin),
    estado: enumerado(d.estado, ESTADOS_PROGRAMA, 'en_curso'),
    responsableUid: textoNulo(d.responsableUid),
    color: texto(d.color, 'neutro'),
    ...sellos(d),
  }
}

export function normalizarProyecto(id: string, d: DocumentData): Proyecto {
  return {
    id,
    programaId: texto(d.programaId),
    portafolioId: texto(d.portafolioId),
    nombre: texto(d.nombre, id),
    descripcion: texto(d.descripcion),
    celulaId: textoNulo(d.celulaId),
    proveedorId: textoNulo(d.proveedorId),
    responsableUid: textoNulo(d.responsableUid),
    fechaInicio: fechaISO(d.fechaInicio),
    fechaFin: fechaISO(d.fechaFin),
    estado: enumerado(d.estado, ESTADOS_PROGRAMA, 'en_curso'),
    ...sellos(d),
  }
}

export function normalizarSitio(id: string, d: DocumentData): Sitio {
  return {
    id,
    nombre: texto(d.nombre, id),
    region: texto(d.region),
    comuna: texto(d.comuna),
    direccion: texto(d.direccion),
    lat: numero(d.lat),
    lon: numero(d.lon),
    tecnologias: listaTexto(d.tecnologias),
    tipoSitio: texto(d.tipoSitio),
    carpetaUrl: textoNulo(d.carpetaUrl),
    activo: booleano(d.activo, true),
    ...sellos(d),
  }
}

function normalizarItemPlantilla(valor: unknown, indice: number): ItemPlantilla {
  const d = objeto(valor)
  return {
    id: texto(d.id, `item-${indice}`),
    texto: texto(d.texto),
    obligatorio: booleano(d.obligatorio, true),
    requiereEvidencia: booleano(d.requiereEvidencia, false),
  }
}

function normalizarGatePlantilla(valor: unknown, indice: number): GatePlantilla | null {
  const d = objeto(valor)
  if (!esCodigoGate(d.codigo)) return null
  return {
    codigo: d.codigo,
    nombre: texto(d.nombre, d.codigo),
    orden: numero(d.orden, indice),
    slaDias: numero(d.slaDias, 0),
    checklist: (Array.isArray(d.checklist) ? d.checklist : []).map(normalizarItemPlantilla),
  }
}

export function normalizarGateTemplate(id: string, d: DocumentData): GateTemplate {
  const gates = (Array.isArray(d.gates) ? d.gates : [])
    .map(normalizarGatePlantilla)
    .filter((g): g is GatePlantilla => g !== null)
  return {
    id,
    nombre: texto(d.nombre, id),
    descripcion: texto(d.descripcion),
    version: numero(d.version, 1),
    activo: booleano(d.activo, true),
    gates,
    ...sellos(d),
  }
}

function normalizarItemChecklist(valor: unknown): ItemChecklist {
  const d = objeto(valor)
  return {
    ok: booleano(d.ok, false),
    obs: texto(d.obs),
    evidenciaUrl: texto(d.evidenciaUrl),
    por: textoNulo(d.por),
    en: instante(d.en),
  }
}

function normalizarGateSitio(valor: unknown, orden: number): GateSitio {
  const d = objeto(valor)
  const checklist: Record<string, ItemChecklist> = {}
  for (const [clave, item] of Object.entries(objeto(d.checklist))) {
    checklist[clave] = normalizarItemChecklist(item)
  }
  return {
    orden: numero(d.orden, orden),
    estado: enumerado(d.estado, ESTADOS_GATE, 'no_iniciado'),
    fechaPlan: fechaISO(d.fechaPlan),
    fechaReal: fechaISO(d.fechaReal),
    fechaBaseline: fechaISO(d.fechaBaseline),
    responsableUid: textoNulo(d.responsableUid),
    proveedorId: textoNulo(d.proveedorId),
    checklist,
    completadoEn: instante(d.completadoEn),
    completadoPor: textoNulo(d.completadoPor),
  }
}

export function normalizarSitioProyecto(id: string, d: DocumentData): SitioProyecto {
  const gates: Partial<Record<CodigoGate, GateSitio>> = {}
  const crudos = objeto(d.gates)
  CODIGOS_GATE.forEach((codigo, i) => {
    if (crudos[codigo] !== undefined) gates[codigo] = normalizarGateSitio(crudos[codigo], i)
  })

  const gateActual = esCodigoGate(d.gateActual)
    ? d.gateActual
    : d.gateActual === CERRADO
      ? CERRADO
      : (CODIGOS_GATE[0] as CodigoGate)

  return {
    id,
    sitioId: texto(d.sitioId),
    proyectoId: texto(d.proyectoId),
    programaId: texto(d.programaId),
    portafolioId: texto(d.portafolioId),
    celulaId: textoNulo(d.celulaId),
    proveedorId: textoNulo(d.proveedorId),
    responsableUid: textoNulo(d.responsableUid),
    sitioNombre: texto(d.sitioNombre),
    region: texto(d.region),
    comuna: texto(d.comuna),
    lat: numero(d.lat),
    lon: numero(d.lon),
    gateActual,
    estadoGate: enumerado(d.estadoGate, ESTADOS_GATE, 'no_iniciado'),
    bloqueado: booleano(d.bloqueado, false),
    motivoBloqueo: textoNulo(d.motivoBloqueo),
    prioridad: enumerado(d.prioridad, PRIORIDADES, 'media'),
    fechaPlanGateActual: fechaISO(d.fechaPlanGateActual),
    gates,
    gateTemplateId: texto(d.gateTemplateId, 'estandar-despliegue'),
    gateTemplateVersion: numero(d.gateTemplateVersion, 1),
    ...sellos(d),
  }
}

function normalizarDependencia(valor: unknown): Dependencia | null {
  const d = objeto(valor)
  const tareaId = textoNulo(d.tareaId)
  if (!tareaId) return null
  return {
    tareaId,
    tipo: enumerado(d.tipo, TIPOS_DEPENDENCIA, 'FS'),
    lagDias: numero(d.lagDias, 0),
  }
}

export function normalizarTarea(id: string, d: DocumentData): Tarea {
  return {
    id,
    titulo: texto(d.titulo, '(sin titulo)'),
    descripcion: texto(d.descripcion),
    estado: enumerado(d.estado, ESTADOS_TAREA, 'backlog'),
    asignadoUid: textoNulo(d.asignadoUid),
    celulaId: textoNulo(d.celulaId),
    sitioId: textoNulo(d.sitioId),
    sitioProyectoId: textoNulo(d.sitioProyectoId),
    proyectoId: textoNulo(d.proyectoId),
    programaId: textoNulo(d.programaId),
    gateCodigo: enumeradoNulo(d.gateCodigo, CODIGOS_GATE),
    prioridad: enumerado(d.prioridad, PRIORIDADES, 'media'),
    fechaInicio: fechaISO(d.fechaInicio),
    fechaVencimiento: fechaISO(d.fechaVencimiento),
    estimacionHoras: numeroNulo(d.estimacionHoras),
    orden: numero(d.orden, 0),
    etiquetas: listaTexto(d.etiquetas),
    dependencias: (Array.isArray(d.dependencias) ? d.dependencias : [])
      .map(normalizarDependencia)
      .filter((x): x is Dependencia => x !== null),
    ...sellos(d),
  }
}

export function normalizarEventoAuditoria(id: string, d: DocumentData): EventoAuditoria {
  return {
    id,
    entidadTipo: enumerado(d.entidadTipo, TIPOS_ENTIDAD, 'sitioProyecto'),
    entidadId: texto(d.entidadId),
    sitioId: textoNulo(d.sitioId),
    proyectoId: textoNulo(d.proyectoId),
    programaId: textoNulo(d.programaId),
    accion: enumerado(d.accion, ACCIONES_AUDITORIA, 'actualizar'),
    campo: textoNulo(d.campo),
    valorAnterior: textoNulo(d.valorAnterior),
    valorNuevo: textoNulo(d.valorNuevo),
    detalle: textoNulo(d.detalle),
    uid: texto(d.uid),
    email: texto(d.email),
    nombre: texto(d.nombre),
    ts: instante(d.ts),
    origen: enumerado(d.origen, ['ui', 'import', 'seed'] as const, 'ui'),
  }
}

export function normalizarRaid(id: string, d: DocumentData): Raid {
  return {
    id,
    tipo: enumerado(d.tipo, TIPOS_RAID, 'riesgo'),
    titulo: texto(d.titulo),
    descripcion: texto(d.descripcion),
    severidad: numero(d.severidad, 1),
    probabilidad: numero(d.probabilidad, 1),
    impacto: numero(d.impacto, 1),
    estado: enumerado(d.estado, ESTADOS_RAID, 'abierto'),
    duenoUid: textoNulo(d.duenoUid),
    fechaCompromiso: fechaISO(d.fechaCompromiso),
    fechaCierre: fechaISO(d.fechaCierre),
    sitioId: textoNulo(d.sitioId),
    proyectoId: textoNulo(d.proyectoId),
    programaId: textoNulo(d.programaId),
    proveedorId: textoNulo(d.proveedorId),
    escalamientos: [],
    ...sellos(d),
  }
}

export interface Comentario {
  id: string
  texto: string
  uid: string
  nombre: string
  gateCodigo: CodigoGate | null
  ts: Date | null
}

export function normalizarComentario(id: string, d: DocumentData): Comentario {
  return {
    id,
    texto: texto(d.texto),
    uid: texto(d.uid),
    nombre: texto(d.nombre),
    gateCodigo: enumeradoNulo(d.gateCodigo, CODIGOS_GATE),
    ts: instante(d.ts),
  }
}
