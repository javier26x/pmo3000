/**
 * Seguimiento de un sitio dentro de un proyecto: donde viven los gates.
 *
 * Nota sobre las consultas: solo se filtra en el servidor por igualdad, sin
 * orderBy. Firestore resuelve las consultas de solo-igualdad combinando indices
 * de campo unico, asi que no hace falta un indice compuesto por cada mezcla de
 * filtros. El orden, la busqueda por texto y el filtro de atrasados se hacen en
 * el cliente sobre el conjunto ya acotado.
 */
import {
  collection,
  doc,
  getDoc,
  limit as limitar,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarComentario, normalizarSitioProyecto, type Comentario } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import { crearGatesDesdePlantilla, type Parche } from '@/domain/gates/maquina'
import { filtroObligatorio } from '@/domain/permisos/matriz'
import { FILTROS_SERVIDOR_VACIOS, type FiltrosSeguimiento } from '@/domain/vistas/filtrado'
import { idSitioProyecto, type SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { Sitio } from '@/domain/tipos/sitio'
import type { Actor, Prioridad } from '@/domain/tipos/comunes'
import type { FechaISO } from '@/domain/fechas'

const convertidor = crearConvertidor(normalizarSitioProyecto)
const convComentario = crearConvertidor(normalizarComentario)

/**
 * Tope de documentos por consulta de seguimiento.
 *
 * No es arbitrario: el documento de seguimiento lleva los 7 gates con su
 * checklist embebidos (~5 kB cada uno), asi que escuchar la coleccion completa
 * significa descargar decenas de megas y mantenerlos en memoria. Medido contra
 * el emulador, pasar de ~2.000 documentos rompe el canal de escucha.
 *
 * La PMO trabaja por programa, asi que el recorte natural es filtrar por
 * programa o proyecto. Cuando una consulta toca este tope, la interfaz lo dice
 * en vez de mostrar un subconjunto silencioso.
 */
export const TOPE_SEGUIMIENTOS = 1500

/**
 * Primera tanda para pintar rápido.
 *
 * Medido: el documento de seguimiento pesa 4,85 kB y el 86% de eso es el mapa de
 * gates con su checklist. Traer 1.500 son ~7 MB y ~9 s hasta el primer pintado.
 * Con esta tanda corta hay tabla y embudo en torno a 1 s, y el resto llega por
 * detrás y reemplaza sin que la persona espere mirando esqueletos.
 */
export const TOPE_PRIMERA_TANDA = 150

export const FILTROS_VACIOS = FILTROS_SERVIDOR_VACIOS
export type { FiltrosSeguimiento }

export function refSeguimiento(id: string) {
  return doc(db, COLECCIONES.sitioProyectos, id).withConverter(convertidor)
}

export function observarSeguimientos(
  actor: Actor,
  filtros: FiltrosSeguimiento,
  cb: (datos: SitioProyecto[]) => void,
  onError: (e: Error) => void,
  tope: number = TOPE_SEGUIMIENTOS,
): Unsubscribe {
  const restricciones = []

  // Un contratista SIEMPRE consulta acotado a su empresa. Sin este where la
  // consulta completa falla con permission-denied: Firestore evalua las reglas
  // documento por documento.
  const obligatorio = filtroObligatorio(actor)
  if (obligatorio) restricciones.push(where(obligatorio.campo, '==', obligatorio.valor))
  else if (filtros.proveedorId) restricciones.push(where('proveedorId', '==', filtros.proveedorId))

  if (filtros.programaId) restricciones.push(where('programaId', '==', filtros.programaId))
  if (filtros.proyectoId) restricciones.push(where('proyectoId', '==', filtros.proyectoId))
  if (filtros.celulaId) restricciones.push(where('celulaId', '==', filtros.celulaId))

  const q = query(
    collection(db, COLECCIONES.sitioProyectos).withConverter(convertidor),
    ...restricciones,
    limitar(tope),
  )

  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export function observarSeguimiento(
  id: string,
  cb: (dato: SitioProyecto | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    refSeguimiento(id),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => onError(e),
  )
}

export function observarSeguimientosDeSitio(
  sitioId: string,
  cb: (datos: SitioProyecto[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLECCIONES.sitioProyectos).withConverter(convertidor),
    where('sitioId', '==', sitioId),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export async function obtenerSeguimiento(id: string): Promise<SitioProyecto | null> {
  const snap = await getDoc(refSeguimiento(id))
  return snap.exists() ? snap.data() : null
}

/**
 * Aplica un parche producido por la maquina de gates (src/domain/gates/maquina)
 * junto con su auditoria, en un solo writeBatch.
 *
 * Cuando se agreguen Cloud Functions (Fase 2), esta funcion pasa a invocar una
 * httpsCallable sin que la UI ni el dominio cambien una linea.
 */
export async function aplicarParche(
  sp: SitioProyecto,
  parche: Parche,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.sitioProyectos, sp.id), {
    ...parche.campos,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })
  agregarEventos(batch, parche.eventos, actor)
  await batch.commit()
}

export interface DatosSeguimientoNuevo {
  sitio: Pick<Sitio, 'id' | 'nombre' | 'region' | 'comuna' | 'lat' | 'lon'>
  proyectoId: string
  programaId: string
  portafolioId: string
  celulaId: string | null
  proveedorId: string | null
  responsableUid: string | null
  plantilla: GateTemplate
  fechaInicio: FechaISO | null
  prioridad: Prioridad
}

/** Documento listo para escribir. Se comparte con el importador por lotes. */
export function prepararSeguimiento(datos: DatosSeguimientoNuevo): {
  id: string
  documento: Record<string, unknown>
} {
  const inicial = crearGatesDesdePlantilla(datos.plantilla, {
    fechaInicio: datos.fechaInicio,
    responsableUid: datos.responsableUid,
    proveedorId: datos.proveedorId,
  })

  return {
    id: idSitioProyecto(datos.proyectoId, datos.sitio.id),
    documento: {
      sitioId: datos.sitio.id,
      proyectoId: datos.proyectoId,
      programaId: datos.programaId,
      portafolioId: datos.portafolioId,
      celulaId: datos.celulaId,
      proveedorId: datos.proveedorId,
      responsableUid: datos.responsableUid,
      sitioNombre: datos.sitio.nombre,
      region: datos.sitio.region,
      comuna: datos.sitio.comuna,
      lat: datos.sitio.lat,
      lon: datos.sitio.lon,
      gateActual: inicial.gateActual,
      estadoGate: inicial.estadoGate,
      bloqueado: false,
      motivoBloqueo: null,
      prioridad: datos.prioridad,
      fechaPlanGateActual: inicial.fechaPlanGateActual,
      gates: inicial.gates,
      gateTemplateId: datos.plantilla.id,
      gateTemplateVersion: datos.plantilla.version,
    },
  }
}

export async function crearSeguimiento(
  datos: DatosSeguimientoNuevo,
  actor: Actor,
): Promise<string> {
  const { id, documento } = prepararSeguimiento(datos)

  const existente = await getDoc(doc(db, COLECCIONES.sitioProyectos, id))
  if (existente.exists()) {
    throw new Error('El sitio ya esta incorporado a ese proyecto')
  }

  const batch = writeBatch(db)
  batch.set(doc(db, COLECCIONES.sitioProyectos, id), {
    ...documento,
    creadoEn: serverTimestamp(),
    creadoPor: actor.uid,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'sitioProyecto',
        entidadId: id,
        sitioId: datos.sitio.id,
        proyectoId: datos.proyectoId,
        programaId: datos.programaId,
        accion: 'crear',
        campo: null,
        valorAnterior: null,
        valorNuevo: `${datos.sitio.id} en ${datos.proyectoId}`,
        detalle: `Plantilla ${datos.plantilla.id} v${datos.plantilla.version}`,
      },
    ],
    actor,
  )
  await batch.commit()
  return id
}

export async function asignarResponsable(
  sp: SitioProyecto,
  cambios: { responsableUid: string | null; proveedorId: string | null; prioridad: Prioridad },
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.sitioProyectos, sp.id), {
    ...cambios,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  const comparables: [keyof typeof cambios, string][] = [
    ['responsableUid', 'responsable'],
    ['proveedorId', 'proveedor'],
    ['prioridad', 'prioridad'],
  ]

  agregarEventos(
    batch,
    comparables
      .filter(([clave]) => String(sp[clave] ?? '') !== String(cambios[clave] ?? ''))
      .map(([clave, etiqueta]) => ({
        entidadTipo: 'sitioProyecto' as const,
        entidadId: sp.id,
        sitioId: sp.sitioId,
        proyectoId: sp.proyectoId,
        programaId: sp.programaId,
        accion: 'asignar' as const,
        campo: etiqueta,
        valorAnterior: sp[clave] === null ? null : String(sp[clave]),
        valorNuevo: cambios[clave] === null ? null : String(cambios[clave]),
        detalle: null,
      })),
    actor,
  )
  await batch.commit()
}

// --- Comentarios (subcoleccion) -------------------------------------------

export function observarComentarios(
  sitioProyectoId: string,
  cb: (datos: Comentario[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(
      db,
      COLECCIONES.sitioProyectos,
      sitioProyectoId,
      COLECCIONES.comentarios,
    ).withConverter(convComentario),
    orderBy('ts', 'desc'),
    limitar(200),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export async function agregarComentario(
  sitioProyectoId: string,
  texto: string,
  gateCodigo: string | null,
  actor: Actor,
): Promise<void> {
  const limpio = texto.trim()
  if (!limpio) throw new Error('El comentario esta vacio')

  await setDoc(
    doc(collection(db, COLECCIONES.sitioProyectos, sitioProyectoId, COLECCIONES.comentarios)),
    {
      texto: limpio,
      uid: actor.uid,
      nombre: actor.nombre,
      gateCodigo,
      ts: serverTimestamp(),
    },
  )
}
