import {
  collection,
  deleteDoc,
  doc,
  limit as limitar,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarTarea } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import type { EstadoTarea, Actor } from '@/domain/tipos/comunes'
import type { Tarea, TareaEditable } from '@/domain/tipos/tarea'

const convertidor = crearConvertidor(normalizarTarea)

export const TOPE_TAREAS = 2000

export function observarTareas(
  filtros: { celulaId: string | null; asignadoUid: string | null; sitioProyectoId: string | null },
  cb: (datos: Tarea[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const restricciones = []
  if (filtros.celulaId) restricciones.push(where('celulaId', '==', filtros.celulaId))
  if (filtros.asignadoUid) restricciones.push(where('asignadoUid', '==', filtros.asignadoUid))
  if (filtros.sitioProyectoId)
    restricciones.push(where('sitioProyectoId', '==', filtros.sitioProyectoId))

  const q = query(
    collection(db, COLECCIONES.tareas).withConverter(convertidor),
    ...restricciones,
    limitar(TOPE_TAREAS),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export interface TareaNueva extends TareaEditable {
  sitioId: string | null
  sitioProyectoId: string | null
  proyectoId: string | null
  programaId: string | null
  gateCodigo: Tarea['gateCodigo']
  orden: number
}

export async function crearTarea(datos: TareaNueva, actor: Actor): Promise<string> {
  const ref = doc(collection(db, COLECCIONES.tareas))
  const batch = writeBatch(db)

  batch.set(ref, {
    ...datos,
    dependencias: [],
    creadoEn: serverTimestamp(),
    creadoPor: actor.uid,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'tarea',
        entidadId: ref.id,
        sitioId: datos.sitioId,
        proyectoId: datos.proyectoId,
        programaId: datos.programaId,
        accion: 'crear',
        campo: null,
        valorAnterior: null,
        valorNuevo: datos.titulo,
        detalle: null,
      },
    ],
    actor,
  )

  await batch.commit()
  return ref.id
}

export async function actualizarTarea(
  tarea: Tarea,
  cambios: Partial<TareaEditable>,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.tareas, tarea.id), {
    ...cambios,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  agregarEventos(
    batch,
    (Object.keys(cambios) as (keyof TareaEditable)[])
      .filter((clave) => String(tarea[clave] ?? '') !== String(cambios[clave] ?? ''))
      .map((clave) => ({
        entidadTipo: 'tarea' as const,
        entidadId: tarea.id,
        sitioId: tarea.sitioId,
        proyectoId: tarea.proyectoId,
        programaId: tarea.programaId,
        accion: 'actualizar' as const,
        campo: String(clave),
        valorAnterior: tarea[clave] === null ? null : String(tarea[clave]),
        valorNuevo: cambios[clave] === null ? null : String(cambios[clave]),
        detalle: null,
      })),
    actor,
  )
  await batch.commit()
}

/** Mover una tarjeta del kanban: cambia estado y posicion en un solo write. */
export async function moverTarea(
  tarea: Tarea,
  destino: { estado: EstadoTarea; orden: number },
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.tareas, tarea.id), {
    estado: destino.estado,
    orden: destino.orden,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  if (tarea.estado !== destino.estado) {
    agregarEventos(
      batch,
      [
        {
          entidadTipo: 'tarea',
          entidadId: tarea.id,
          sitioId: tarea.sitioId,
          proyectoId: tarea.proyectoId,
          programaId: tarea.programaId,
          accion: 'actualizar',
          campo: 'estado',
          valorAnterior: tarea.estado,
          valorNuevo: destino.estado,
          detalle: null,
        },
      ],
      actor,
    )
  }

  await batch.commit()
}

export async function eliminarTarea(tarea: Tarea, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'tarea',
        entidadId: tarea.id,
        sitioId: tarea.sitioId,
        proyectoId: tarea.proyectoId,
        programaId: tarea.programaId,
        accion: 'eliminar',
        campo: null,
        valorAnterior: tarea.titulo,
        valorNuevo: null,
        detalle: null,
      },
    ],
    actor,
  )
  await batch.commit()
  await deleteDoc(doc(db, COLECCIONES.tareas, tarea.id))
}
