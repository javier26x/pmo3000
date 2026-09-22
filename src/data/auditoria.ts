import { collection, doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { COLECCIONES, db } from './firebase'
import type { EventoAuditoriaNuevo } from '@/domain/tipos/auditoria'
import type { Actor } from '@/domain/tipos/comunes'

export type OrigenEvento = 'ui' | 'import' | 'seed'

/**
 * Agrega eventos de auditoria al MISMO writeBatch que el cambio que los origina.
 * Asi el cambio y su rastro entran juntos o no entran: no existe un cambio sin
 * registro por una caida a medio camino.
 *
 * Limite conocido de la Fase 1 (sin Cloud Functions): las reglas verifican que el
 * evento venga con el uid correcto y que nadie lo edite despues, pero no pueden
 * exigir que toda escritura traiga su evento. En Fase 2 un trigger onWrite lo
 * genera del lado del servidor y esta ventana se cierra.
 */
export function agregarEventos(
  batch: WriteBatch,
  eventos: readonly EventoAuditoriaNuevo[],
  actor: Actor,
  origen: OrigenEvento = 'ui',
): void {
  for (const evento of eventos) {
    batch.set(doc(collection(db, COLECCIONES.auditoria)), {
      ...evento,
      uid: actor.uid,
      email: actor.email,
      nombre: actor.nombre,
      ts: serverTimestamp(),
      origen,
    })
  }
}
