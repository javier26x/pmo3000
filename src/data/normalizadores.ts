import type { DocumentData } from 'firebase/firestore'
import {
  booleano,
  enumerado,
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
  type CampoPlantilla,
  type GatePlantilla,
  type GateTemplate,
  type RevisionPlantilla,
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
import type {
  GateSitio,
  ItemChecklist,
  RevisionSitio,
  SitioProyecto,
} from '@/domain/tipos/sitioProyecto'
import { CERRADO, COLORES_GATE, TIPOS_ETAPA, type CodigoGate } from '@/domain/gates/catalogo'
import { ESTADOS_SEMANTICOS, type EstadoSemantico } from '@/domain/tracker/estados'
import { TIPOS_CAMPO } from '@/domain/tracker/campos'

export function normalizarUsuario(id: string, d: DocumentData): Usuario {
  return {
    id,
    email: texto(d.email).toLowerCase(),
    nombre: texto(d.nombre, texto(d.email)),
    rol: enumerado(d.rol, ROLES, 'lector'),
    celulaId: textoNulo(d.celulaId),
    proveedorId: textoNulo(d.proveedorId),
    // Los perfiles anteriores al alcance no traen el campo: listas vacias, que
    // significan "sin restriccion", igual que en firestore.rules.
    alcance: {
      celulas: listaTexto(objeto(d.alcance).celulas),
      programas: listaTexto(objeto(d.alcance).programas),
      proyectos: listaTexto(objeto(d.alcance).proyectos),
    },
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
    filtroTracker: normalizarFiltroTracker(d.filtroTracker),
    ...sellos(d),
  }
}

function normalizarFiltroTracker(valor: unknown): Proyecto['filtroTracker'] {
  const d = objeto(valor)
  if (!Array.isArray(d.planes)) return null
  return {
    planes: d.planes.filter((p): p is string => typeof p === 'string' && p !== ''),
    soloVigentes: booleano(d.soloVigentes, true),
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

function normalizarRevisionPlantilla(valor: unknown, indice: number): RevisionPlantilla {
  const d = objeto(valor)
  const nombre = texto(d.nombre, `Revisión ${indice + 1}`)
  return {
    id: texto(d.id, `rev-${indice}`),
    nombre,
    bloquea: booleano(d.bloquea, true),
  }
}

function normalizarGatePlantilla(valor: unknown, indice: number): GatePlantilla | null {
  const d = objeto(valor)
  // El codigo ya no se valida contra una lista: lo define la plantilla. Lo unico
  // exigible es que exista, porque es la clave del gate en el documento.
  const codigo = texto(d.codigo)
  if (codigo === '') return null
  return {
    codigo,
    nombre: texto(d.nombre, codigo),
    descripcion: texto(d.descripcion),
    color: enumerado(d.color, COLORES_GATE, 'gris'),
    orden: numero(d.orden, indice),
    slaDias: numero(d.slaDias, 0),
    checklist: (Array.isArray(d.checklist) ? d.checklist : []).map(normalizarItemPlantilla),
    revisiones: (Array.isArray(d.revisiones) ? d.revisiones : []).map(normalizarRevisionPlantilla),
    // Sin tipo es secuencial: es lo que eran todas las etapas antes del campo.
    tipo: enumerado(d.tipo, TIPOS_ETAPA, 'secuencial'),
  }
}

function normalizarCampoPlantilla(valor: unknown): CampoPlantilla | null {
  const d = objeto(valor)
  const id = texto(d.id)
  if (id === '') return null
  return {
    id,
    nombre: texto(d.nombre, id),
    tipo: enumerado(d.tipo, TIPOS_CAMPO, 'texto'),
    grupo: texto(d.grupo, 'General'),
    opciones: (Array.isArray(d.opciones) ? d.opciones : []).map((o) => texto(o)),
    enTabla: booleano(d.enTabla, false),
    origen: textoNulo(d.origen),
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
    campos: (Array.isArray(d.campos) ? d.campos : [])
      .map(normalizarCampoPlantilla)
      .filter((c): c is CampoPlantilla => c !== null),
    homologacion: normalizarHomologacion(d.homologacion),
    ...sellos(d),
  }
}

/** Valores de los campos declarados en la plantilla. Solo tipos que Firestore guarda. */
function normalizarValores(valor: unknown): Record<string, string | number | boolean | null> {
  const salida: Record<string, string | number | boolean | null> = {}
  for (const [clave, bruto] of Object.entries(objeto(valor))) {
    if (bruto === null) salida[clave] = null
    else if (typeof bruto === 'string' || typeof bruto === 'number' || typeof bruto === 'boolean') {
      salida[clave] = bruto
    }
  }
  return salida
}

/** Tabla de homologacion de estados de la plantilla. Ver domain/tracker/estados.ts. */
function normalizarHomologacion(valor: unknown): Record<string, EstadoSemantico> {
  const salida: Record<string, EstadoSemantico> = {}
  for (const [clave, bruto] of Object.entries(objeto(valor))) {
    if (typeof bruto !== 'string') continue
    if ((ESTADOS_SEMANTICOS as readonly string[]).includes(bruto)) {
      salida[clave] = bruto as EstadoSemantico
    }
  }
  return salida
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

function normalizarRevisionSitio(valor: unknown): RevisionSitio {
  const d = objeto(valor)
  return {
    estado: texto(d.estado),
    comentario: texto(d.comentario),
    fecha: fechaISO(d.fecha),
    por: textoNulo(d.por),
    en: instante(d.en),
  }
}

function normalizarGateSitio(valor: unknown, codigo: string, orden: number): GateSitio {
  const d = objeto(valor)
  const checklist: Record<string, ItemChecklist> = {}
  for (const [clave, item] of Object.entries(objeto(d.checklist))) {
    checklist[clave] = normalizarItemChecklist(item)
  }
  const revisiones: Record<string, RevisionSitio> = {}
  for (const [clave, rev] of Object.entries(objeto(d.revisiones))) {
    revisiones[clave] = normalizarRevisionSitio(rev)
  }
  return {
    orden: numero(d.orden, orden),
    nombre: texto(d.nombre, codigo),
    color: enumerado(d.color, COLORES_GATE, 'gris'),
    siguiente: textoNulo(d.siguiente),
    tipo: enumerado(d.tipo, TIPOS_ETAPA, 'secuencial'),
    estado: enumerado(d.estado, ESTADOS_GATE, 'no_iniciado'),
    fechaPlan: fechaISO(d.fechaPlan),
    fechaReal: fechaISO(d.fechaReal),
    fechaBaseline: fechaISO(d.fechaBaseline),
    responsableUid: textoNulo(d.responsableUid),
    proveedorId: textoNulo(d.proveedorId),
    checklist,
    revisiones,
    completadoEn: instante(d.completadoEn),
    completadoPor: textoNulo(d.completadoPor),
  }
}

export function normalizarSitioProyecto(id: string, d: DocumentData): SitioProyecto {
  // Los codigos ya no vienen de una lista fija: son las claves que el documento
  // traiga, que es lo que la plantilla de ese programa definio.
  const gates: Partial<Record<CodigoGate, GateSitio>> = {}
  const crudos = objeto(d.gates)
  Object.keys(crudos)
    .map((codigo) => ({ codigo, orden: numero(objeto(crudos[codigo]).orden, 0) }))
    .sort((a, b) => a.orden - b.orden)
    .forEach(({ codigo }, i) => {
      gates[codigo] = normalizarGateSitio(crudos[codigo], codigo, i)
    })

  const primerGate = Object.entries(gates).sort(
    (a, b) => (a[1]?.orden ?? 0) - (b[1]?.orden ?? 0),
  )[0]?.[0]
  const crudoActual = texto(d.gateActual)
  const gateActual =
    crudoActual === CERRADO || (crudoActual !== '' && gates[crudoActual] !== undefined)
      ? crudoActual
      : (primerGate ?? CERRADO)

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
    // Los seguimientos anteriores al campo son vigentes: nadie los dio de baja.
    vigente: booleano(d.vigente, true),
    prioridad: enumerado(d.prioridad, PRIORIDADES, 'media'),
    fechaPlanGateActual: fechaISO(d.fechaPlanGateActual),
    gates,
    pasos: normalizarPasos(d.pasos),
    valores: normalizarValores(d.valores),
    gateTemplateId: texto(d.gateTemplateId, 'estandar-despliegue'),
    gateTemplateVersion: numero(d.gateTemplateVersion, 1),
    ...sellos(d),
  }
}

/** null si el documento es anterior al campo (o lo trae roto). */
function normalizarPasos(valor: unknown): Record<string, string | null> | null {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return null
  const pasos: Record<string, string | null> = {}
  for (const [codigo, siguiente] of Object.entries(valor as Record<string, unknown>)) {
    pasos[codigo] = typeof siguiente === 'string' ? siguiente : null
  }
  return pasos
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
    gateCodigo: textoNulo(d.gateCodigo),
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
    gateCodigo: textoNulo(d.gateCodigo),
    ts: instante(d.ts),
  }
}
