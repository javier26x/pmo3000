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
  and,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  getDoc,
  limit as limitar,
  onSnapshot,
  or,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Query,
  type QueryFieldFilterConstraint,
  type QueryNonFilterConstraint,
  type WriteBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarComentario, normalizarSitioProyecto, type Comentario } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import { crearGatesDesdePlantilla, type Parche } from '@/domain/gates/maquina'
import { pasosDeGates } from '@/domain/gates/catalogo'
import { filtroObligatorio } from '@/domain/permisos/matriz'
import { planAlcance } from '@/domain/permisos/alcance'
import { FILTROS_SERVIDOR_VACIOS, type FiltrosSeguimiento } from '@/domain/vistas/filtrado'
import { idSitioProyecto, type SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { Sitio } from '@/domain/tipos/sitio'
import type { Actor, Prioridad } from '@/domain/tipos/comunes'
import type { FechaISO } from '@/domain/fechas'
import type { EventoAuditoriaNuevo } from '@/domain/tipos/auditoria'

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

/** Campos por los que se filtra un seguimiento con igualdad en el servidor. */
export type IgualdadesSeguimiento = Partial<
  Record<'sitioId' | 'proveedorId' | 'programaId' | 'proyectoId' | 'celulaId', string>
>

/**
 * Consulta de seguimientos con lo que las reglas exigen para ESTE actor, o null
 * si con esos filtros no hay nada que el actor pueda ver (no hace falta ir al
 * servidor).
 *
 * Firestore evalua las reglas sobre la CONSULTA: si la consulta no demuestra
 * que todo lo que puede devolver es visible, falla completa con
 * permission-denied. Por eso toda consulta de la coleccion pasa por aqui y
 * lleva:
 *
 * - el filtro por proveedor del contratista (filtroObligatorio), y
 * - si el actor tiene alcance, un or() con un where-in por cada lista del
 *   alcance (celulaId in C, programaId in P, proyectoId in Q), ajustado a las
 *   igualdades que ya trae la consulta. El ajuste no es cosmetico: ver
 *   planAlcance() en src/domain/permisos/alcance.ts.
 *
 * El or() no pasa de 30 valores (MAX_ENTRADAS_ALCANCE), asi que la consulta
 * combinada tampoco pasa del tope de disyunciones de Firestore. Son todas
 * igualdades, sin orderBy: no piden indices compuestos.
 */
export function consultaVisible(
  actor: Pick<Actor, 'rol' | 'proveedorId' | 'alcance'>,
  igualdades: IgualdadesSeguimiento,
  ...resto: QueryNonFilterConstraint[]
): Query<SitioProyecto> | null {
  const base = collection(db, COLECCIONES.sitioProyectos).withConverter(convertidor)

  const fijados: IgualdadesSeguimiento = { ...igualdades }
  const obligatorio = filtroObligatorio(actor)
  if (obligatorio) fijados[obligatorio.campo] = obligatorio.valor

  const filtros: QueryFieldFilterConstraint[] = Object.entries(fijados)
    .filter((par): par is [string, string] => typeof par[1] === 'string' && par[1] !== '')
    .map(([campo, valor]) => where(campo, '==', valor))

  const plan = planAlcance(actor, fijados)
  if (plan.tipo === 'vacio') return null
  if (plan.tipo === 'sinRestriccion') return query(base, ...filtros, ...resto)

  const enAlcance = or(...plan.disyunciones.map((d) => where(d.campo, 'in', d.valores)))
  return query(base, and(...filtros, enAlcance), ...resto)
}

/** Para cuando consultaVisible() dice que no hay nada: entrega [] y no escucha. */
function suscripcionVacia(cb: (datos: SitioProyecto[]) => void): Unsubscribe {
  let activa = true
  queueMicrotask(() => {
    if (activa) cb([])
  })
  return () => {
    activa = false
  }
}

export function observarSeguimientos(
  actor: Actor,
  filtros: FiltrosSeguimiento,
  cb: (datos: SitioProyecto[]) => void,
  onError: (e: Error) => void,
  tope: number = TOPE_SEGUIMIENTOS,
): Unsubscribe {
  // Un contratista SIEMPRE consulta acotado a su empresa: consultaVisible le
  // pone su proveedor encima de lo que diga el filtro.
  const q = consultaVisible(
    actor,
    {
      ...(filtros.proveedorId ? { proveedorId: filtros.proveedorId } : {}),
      ...(filtros.programaId ? { programaId: filtros.programaId } : {}),
      ...(filtros.proyectoId ? { proyectoId: filtros.proyectoId } : {}),
      ...(filtros.celulaId ? { celulaId: filtros.celulaId } : {}),
    },
    limitar(tope),
  )
  if (!q) return suscripcionVacia(cb)

  // Cuando alguien avanza un gate, el snapshot trae los 1.500 documentos pero
  // solo uno cambio. Normalizar solo los que cambiaron ahorra el trabajo y, mas
  // importante, conserva la identidad de los demas objetos: las filas, el mapa y
  // los calculos memoizados que dependen de ellos no se rehacen.
  const vigentes = new Map<string, SitioProyecto>()

  return onSnapshot(
    q,
    (snap) => {
      for (const cambio of snap.docChanges()) {
        if (cambio.type === 'removed') vigentes.delete(cambio.doc.id)
        else vigentes.set(cambio.doc.id, cambio.doc.data())
      }
      cb(snap.docs.map((d) => vigentes.get(d.id) ?? d.data()))
    },
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

/**
 * Participaciones de un sitio en sus proyectos. Un usuario acotado ve solo las
 * de su alcance (y un contratista, las de su empresa): el mismo sitio puede
 * estar en proyectos que no le corresponden.
 */
export function observarSeguimientosDeSitio(
  actor: Actor,
  sitioId: string,
  cb: (datos: SitioProyecto[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = consultaVisible(actor, { sitioId })
  if (!q) return suscripcionVacia(cb)
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
      pasos: pasosDeGates(inicial.gates),
      gateTemplateId: datos.plantilla.id,
      gateTemplateVersion: datos.plantilla.version,
    },
  }
}

/**
 * Completa `pasos` (la secuencia congelada que leen las reglas) en los
 * seguimientos anteriores a ese campo. Solo admin: nadie mas puede escribirlo.
 *
 * Mientras un seguimiento no lo tenga, las reglas validan los avances con el
 * enlace `siguiente` del mapa de gates, que quien avanza puede reescribir en la
 * misma escritura. Correrlo una vez cierra eso para todos los existentes; los
 * nuevos ya nacen con `pasos`. Volver a correrlo es seguro: solo toca los que
 * falten.
 */
export async function completarPasos(
  actor: Actor,
  onAvance?: (hechos: number, total: number) => void,
): Promise<{ revisados: number; completados: number }> {
  const snap = await getDocs(collection(db, COLECCIONES.sitioProyectos).withConverter(convertidor))
  const faltan = snap.docs.map((d) => d.data()).filter((sp) => sp.pasos === null)

  for (let i = 0; i < faltan.length; i += MAX_OPERACIONES) {
    const lote = writeBatch(db)
    for (const sp of faltan.slice(i, i + MAX_OPERACIONES)) {
      lote.update(doc(db, COLECCIONES.sitioProyectos, sp.id), {
        pasos: pasosDeGates(sp.gates),
        actualizadoEn: serverTimestamp(),
        actualizadoPor: actor.uid,
      })
    }
    await lote.commit()
    onAvance?.(Math.min(i + MAX_OPERACIONES, faltan.length), faltan.length)
  }

  if (faltan.length > 0) {
    const cierre = writeBatch(db)
    agregarEventos(
      cierre,
      [
        {
          entidadTipo: 'sitioProyecto',
          entidadId: 'secuencias',
          sitioId: null,
          proyectoId: null,
          programaId: null,
          accion: 'actualizar',
          campo: 'pasos',
          valorAnterior: null,
          valorNuevo: String(faltan.length),
          detalle: `Secuencia congelada en ${faltan.length} seguimiento(s) anteriores al campo`,
        },
      ],
      actor,
    )
    await cierre.commit()
  }
  return { revisados: snap.size, completados: faltan.length }
}

/**
 * Cuales de esos seguimientos ya existen. Lee de a uno (en tandas paralelas):
 * las reglas permiten leer un id inexistente, y una consulta por id no
 * demostraria el alcance. Quien llama debe pasar solo ids dentro de su alcance.
 */
export async function seguimientosExistentes(ids: readonly string[]): Promise<Set<string>> {
  const existentes = new Set<string>()
  const TANDA = 50
  for (let i = 0; i < ids.length; i += TANDA) {
    const tanda = ids.slice(i, i + TANDA)
    const snaps = await Promise.all(
      tanda.map((id) => getDoc(doc(db, COLECCIONES.sitioProyectos, id))),
    )
    for (const s of snaps) if (s.exists()) existentes.add(s.id)
  }
  return existentes
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

// --- Eliminacion (solo admin) ---------------------------------------------

/**
 * Tope de operaciones por lote. Firestore admite 500; se deja margen para que
 * la auditoria siempre quepa junto al cambio que la origina.
 */
const MAX_OPERACIONES = 450

/** Comentarios de un seguimiento, sin tope: al eliminar hay que llevarlos todos. */
async function refsComentarios(sitioProyectoId: string): Promise<DocumentReference[]> {
  const snap = await getDocs(
    collection(db, COLECCIONES.sitioProyectos, sitioProyectoId, COLECCIONES.comentarios),
  )
  return snap.docs.map((d) => d.ref)
}

function eventoEliminacion(
  sp: Pick<SitioProyecto, 'id' | 'sitioId' | 'proyectoId' | 'programaId' | 'gateActual'>,
  motivo: string,
): EventoAuditoriaNuevo {
  return {
    entidadTipo: 'sitioProyecto',
    entidadId: sp.id,
    sitioId: sp.sitioId,
    proyectoId: sp.proyectoId,
    programaId: sp.programaId,
    accion: 'eliminar',
    campo: null,
    valorAnterior: `${sp.sitioId} en ${sp.proyectoId} (etapa ${sp.gateActual})`,
    valorNuevo: null,
    detalle: motivo.trim() || null,
  }
}

/**
 * Arma los lotes de una eliminacion: cada seguimiento viaja con su evento de
 * auditoria en el MISMO lote, y sus comentarios en ese lote o en los siguientes.
 *
 * El orden importa por las reglas: un comentario solo se puede borrar si su
 * seguimiento ya no existe despues de la escritura (existsAfter). Por eso el
 * seguimiento va siempre en el primer lote que toca sus comentarios, y los que
 * no quepan van en lotes posteriores, cuando el padre ya no esta.
 */
class Lotes {
  /**
   * Unidades que tienen que viajar juntas en un mismo lote: el borrado de un
   * seguimiento con su evento de auditoria, o un comentario suelto. Se guardan
   * como operaciones y no como WriteBatch armados, para poder repartirlas de
   * nuevo si Firestore rechaza un lote por grande.
   */
  private readonly unidades: { ops: number; aplicar: (lote: WriteBatch) => void }[] = []

  constructor(private readonly actor: Actor) {}

  eliminar(ref: DocumentReference, evento: EventoAuditoriaNuevo, comentarios: DocumentReference[]) {
    // El seguimiento va antes que sus comentarios: las reglas solo dejan borrar
    // un comentario cuyo padre ya no existe despues de la escritura, y como los
    // lotes se confirman en orden, un comentario nunca queda en un lote anterior.
    this.unidades.push({
      ops: 2,
      aplicar: (lote) => {
        lote.delete(ref)
        agregarEventos(lote, [evento], this.actor)
      },
    })
    for (const c of comentarios) this.unidades.push({ ops: 1, aplicar: (lote) => lote.delete(c) })
  }

  evento(evento: EventoAuditoriaNuevo) {
    this.unidades.push({ ops: 1, aplicar: (lote) => agregarEventos(lote, [evento], this.actor) })
  }

  /**
   * Confirma en orden. Si un lote falla, los anteriores ya quedaron y nada del
   * que fallo se escribio (un lote es atomico).
   *
   * Firestore limita un lote a 500 operaciones y ademas a un tamano total que
   * incluye las entradas de indice que se borran. Un seguimiento con sus etapas
   * embebidas mueve muchas, asi que 450 borrados pueden pasarse aunque el conteo
   * de operaciones este bien ("Transaction too big"). En ese caso el lote se
   * parte a la mitad y se reintenta, sin cortar la eliminacion.
   */
  async confirmar(onAvance?: (hechos: number, total: number) => void): Promise<void> {
    const total = this.unidades.length
    let i = 0
    let tope = MAX_OPERACIONES
    while (i < total) {
      // Arma el lote que cabe desde la unidad i con el tope actual.
      let fin = i
      let ops = 0
      while (fin < total && (ops === 0 || ops + (this.unidades[fin]?.ops ?? 0) <= tope)) {
        ops += this.unidades[fin]?.ops ?? 0
        fin++
      }
      const lote = writeBatch(db)
      for (let k = i; k < fin; k++) this.unidades[k]?.aplicar(lote)
      try {
        await lote.commit()
      } catch (e) {
        // Con una sola unidad ya no hay que partir. Tope 1 deja pasar igual una
        // unidad de 2 operaciones (la primera siempre entra), y como el lote
        // siguiente siempre es menor que este, el ciclo termina.
        if (esLoteDemasiadoGrande(e) && fin - i > 1) {
          tope = Math.max(1, Math.floor(ops / 2))
          continue
        }
        throw e
      }
      i = fin
      onAvance?.(i, total)
    }
  }
}

function esLoteDemasiadoGrande(e: unknown): boolean {
  const texto = e instanceof Error ? e.message : String(e)
  return /too big|too large|exceeds the maximum|demasiado grande/i.test(texto)
}

/**
 * Elimina un seguimiento con sus comentarios y deja el rastro en la auditoria.
 * Solo admin (las reglas lo exigen). El maestro del sitio NO se toca: puede
 * estar en otros proyectos. Las tareas que apuntaban al seguimiento quedan con
 * la referencia colgando, igual que antes de existir esta funcion.
 */
export async function eliminarSeguimiento(
  sp: SitioProyecto,
  motivo: string,
  actor: Actor,
): Promise<{ comentarios: number }> {
  const comentarios = await refsComentarios(sp.id)
  const lotes = new Lotes(actor)
  lotes.eliminar(
    doc(db, COLECCIONES.sitioProyectos, sp.id),
    eventoEliminacion(sp, motivo),
    comentarios,
  )
  await lotes.confirmar()
  return { comentarios: comentarios.length }
}

/**
 * Cuantos seguimientos tiene un proyecto. Lee el conteo, no los documentos.
 * Sin acotar por alcance: solo la usa el admin, antes de eliminar.
 */
export async function contarSeguimientosDeProyecto(proyectoId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COLECCIONES.sitioProyectos), where('proyectoId', '==', proyectoId)),
  )
  return snap.data().count
}

export interface AvanceEliminacion {
  fase: 'leyendo' | 'escribiendo'
  hechos: number
  total: number
}

/**
 * Elimina TODOS los seguimientos de un proyecto (por ejemplo, para deshacer una
 * importacion de tracker equivocada). Un evento de auditoria por seguimiento,
 * en el mismo lote que su borrado, mas un evento resumen sobre el proyecto al
 * final. Los sitios del maestro no se tocan.
 *
 * No es atomica: son varios lotes. Si se corta a medio camino, lo borrado queda
 * borrado y auditado, y volver a ejecutarla termina el trabajo.
 */
export async function eliminarSeguimientosDeProyecto(
  proyectoId: string,
  motivo: string,
  actor: Actor,
  onAvance?: (avance: AvanceEliminacion) => void,
): Promise<{ seguimientos: number; comentarios: number }> {
  if (!motivo.trim()) throw new Error('Eliminar seguimientos exige un motivo')

  // Es cosa de admin, que no tiene alcance; consultaVisible deja la consulta
  // igual que siempre y no hay que recordar agregarle nada si eso cambia.
  const consulta = consultaVisible(actor, { proyectoId })
  const seguimientos = consulta ? (await getDocs(consulta)).docs.map((d) => d.data()) : []
  if (seguimientos.length === 0) return { seguimientos: 0, comentarios: 0 }

  // Los comentarios se leen en tandas en paralelo: uno por uno serian 1.500
  // idas y vueltas.
  const comentarios = new Map<string, DocumentReference[]>()
  const PARALELO = 16
  for (let i = 0; i < seguimientos.length; i += PARALELO) {
    const tanda = seguimientos.slice(i, i + PARALELO)
    const refs = await Promise.all(tanda.map((sp) => refsComentarios(sp.id)))
    tanda.forEach((sp, j) => comentarios.set(sp.id, refs[j] ?? []))
    onAvance?.({
      fase: 'leyendo',
      hechos: Math.min(i + PARALELO, seguimientos.length),
      total: seguimientos.length,
    })
  }

  const lotes = new Lotes(actor)
  let totalComentarios = 0
  for (const sp of seguimientos) {
    const propios = comentarios.get(sp.id) ?? []
    totalComentarios += propios.length
    lotes.eliminar(
      doc(db, COLECCIONES.sitioProyectos, sp.id),
      eventoEliminacion(sp, motivo),
      propios,
    )
  }
  lotes.evento({
    entidadTipo: 'proyecto',
    entidadId: proyectoId,
    sitioId: null,
    proyectoId,
    programaId: seguimientos[0]?.programaId ?? null,
    accion: 'eliminar',
    campo: 'sitioProyectos',
    valorAnterior: String(seguimientos.length),
    valorNuevo: '0',
    detalle: `Eliminacion masiva de ${seguimientos.length} seguimientos: ${motivo.trim()}`,
  })

  await lotes.confirmar((hechos, total) => onAvance?.({ fase: 'escribiendo', hechos, total }))
  return { seguimientos: seguimientos.length, comentarios: totalComentarios }
}
