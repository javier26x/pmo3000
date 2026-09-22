/**
 * Areas que revisan etapas y quienes responden por ellas. Pocos documentos: se
 * observan completos junto con los demas catalogos.
 */
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { agregarEventos } from '../auditoria'
import { normalizarArea } from '../normalizadores'
import { AREAS_SEMILLA, type Area } from '@/domain/tipos/area'
import type { Actor } from '@/domain/tipos/comunes'

const convArea = crearConvertidor(normalizarArea)

export function observarAreas(
  cb: (areas: Area[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLECCIONES.areas).withConverter(convArea), orderBy('nombre')),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export type DatosArea = Pick<Area, 'nombre' | 'alias' | 'responsables' | 'porProyecto' | 'activa'>

/**
 * Crea o reemplaza un area. Es un set completo, no un merge: con merge, quitar
 * un proyecto de las excepciones no lo borraria (los mapas se fusionan).
 */
export async function guardarArea(
  id: string,
  datos: DatosArea,
  actor: Actor,
  anterior: Area | null,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, COLECCIONES.areas, id), {
    ...datos,
    creadoEn: anterior?.creadoEn ?? serverTimestamp(),
    creadoPor: anterior?.creadoPor ?? actor.uid,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'usuario',
        entidadId: id,
        sitioId: null,
        proyectoId: null,
        programaId: null,
        accion: anterior ? 'actualizar' : 'crear',
        campo: 'area',
        valorAnterior: anterior ? resumen(anterior) : null,
        valorNuevo: resumen(datos),
        detalle: COLECCIONES.areas,
      },
    ],
    actor,
  )
  await batch.commit()
}

function resumen(a: DatosArea): string {
  const excepciones = Object.keys(a.porProyecto).length
  return `${a.nombre}: ${a.responsables.length} responsable(s)${
    excepciones > 0 ? `, ${excepciones} proyecto(s) con otras personas` : ''
  }${a.activa ? '' : ', inactiva'}`
}

export async function eliminarArea(area: Area, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, COLECCIONES.areas, area.id))
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'usuario',
        entidadId: area.id,
        sitioId: null,
        proyectoId: null,
        programaId: null,
        accion: 'eliminar',
        campo: 'area',
        valorAnterior: resumen(area),
        valorNuevo: null,
        detalle: COLECCIONES.areas,
      },
    ],
    actor,
  )
  await batch.commit()
}

/** Crea las areas de los trackers que falten (sin responsables todavia). */
export async function crearAreasSemilla(
  existentes: readonly Area[],
  actor: Actor,
): Promise<number> {
  const ids = new Set(existentes.map((a) => a.id))
  const faltan = AREAS_SEMILLA.filter((a) => !ids.has(a.id))
  for (const a of faltan) {
    await guardarArea(
      a.id,
      { nombre: a.nombre, alias: a.alias, responsables: [], porProyecto: {}, activa: true },
      actor,
      null,
    )
  }
  return faltan.length
}
