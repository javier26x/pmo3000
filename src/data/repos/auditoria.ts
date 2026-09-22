import {
  collection,
  limit as limitar,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarEventoAuditoria } from '../normalizadores'
import type { EventoAuditoria } from '@/domain/tipos/auditoria'

const convertidor = crearConvertidor(normalizarEventoAuditoria)

/** Historial de una entidad (la ficha de sitio lo muestra completo). */
export function observarHistorial(
  entidadId: string,
  cb: (datos: EventoAuditoria[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLECCIONES.auditoria).withConverter(convertidor),
    where('entidadId', '==', entidadId),
    orderBy('ts', 'desc'),
    limitar(200),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

/** Log global, para la pantalla de auditoria. */
export function observarAuditoria(
  filtros: { sitioId: string | null; programaId: string | null; uid: string | null },
  tope: number,
  cb: (datos: EventoAuditoria[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const restricciones = []
  if (filtros.sitioId) restricciones.push(where('sitioId', '==', filtros.sitioId))
  if (filtros.programaId) restricciones.push(where('programaId', '==', filtros.programaId))
  if (filtros.uid) restricciones.push(where('uid', '==', filtros.uid))

  const q = query(
    collection(db, COLECCIONES.auditoria).withConverter(convertidor),
    ...restricciones,
    orderBy('ts', 'desc'),
    limitar(tope),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}
