import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitar,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarSitio } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import { aTextoAuditoria } from '@/domain/tipos/auditoria'
import type { Sitio, SitioNuevo } from '@/domain/tipos/sitio'
import type { Actor } from '@/domain/tipos/comunes'

const convertidor = crearConvertidor(normalizarSitio)

/**
 * Tope de seguridad. El maestro real ronda los 4.500 sitios; el listener inicial
 * cuesta una lectura por documento y despues solo paga los cambios. Si el maestro
 * crece mucho mas, conviene paginar por region.
 */
export const TOPE_SITIOS = 6000

export function refSitio(id: string) {
  return doc(db, COLECCIONES.sitios, id).withConverter(convertidor)
}

export function observarSitios(
  cb: (sitios: Sitio[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLECCIONES.sitios).withConverter(convertidor),
    orderBy('nombre'),
    limitar(TOPE_SITIOS),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export function observarSitio(
  id: string,
  cb: (sitio: Sitio | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    refSitio(id),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => onError(e),
  )
}

export async function obtenerSitio(id: string): Promise<Sitio | null> {
  const snap = await getDoc(refSitio(id))
  return snap.exists() ? snap.data() : null
}

/**
 * IDs del maestro, para detectar duplicados antes de importar.
 * Cuesta una lectura por sitio (~4.500, holgado dentro de la cuota gratuita
 * diaria de 50.000). Si molestara, se cambia por un documento indice con la
 * lista de IDs; se dejo asi por simplicidad y porque no puede desincronizarse.
 */
export async function idsExistentes(): Promise<Set<string>> {
  const snap = await getDocs(query(collection(db, COLECCIONES.sitios), limitar(TOPE_SITIOS)))
  return new Set(snap.docs.map((d) => d.id))
}

export async function guardarSitio(
  datos: SitioNuevo,
  actor: Actor,
  anterior: Sitio | null,
): Promise<void> {
  const batch = writeBatch(db)
  const { id, ...campos } = datos

  batch.set(
    doc(db, COLECCIONES.sitios, id),
    {
      ...campos,
      ...(anterior ? {} : { creadoEn: serverTimestamp(), creadoPor: actor.uid }),
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )

  const eventos = anterior
    ? (Object.keys(campos) as (keyof typeof campos)[])
        .filter((clave) => aTextoAuditoria(anterior[clave]) !== aTextoAuditoria(campos[clave]))
        .map((clave) => ({
          entidadTipo: 'sitio' as const,
          entidadId: id,
          sitioId: id,
          proyectoId: null,
          programaId: null,
          accion: 'actualizar' as const,
          campo: String(clave),
          valorAnterior: aTextoAuditoria(anterior[clave]),
          valorNuevo: aTextoAuditoria(campos[clave]),
          detalle: null,
        }))
    : [
        {
          entidadTipo: 'sitio' as const,
          entidadId: id,
          sitioId: id,
          proyectoId: null,
          programaId: null,
          accion: 'crear' as const,
          campo: null,
          valorAnterior: null,
          valorNuevo: datos.nombre,
          detalle: `${datos.comuna}, ${datos.region}`,
        },
      ]

  agregarEventos(batch, eventos, actor)
  await batch.commit()
}

/** La URL de la carpeta de SharePoint se edita a mano (Fase 2 la prellena). */
export async function actualizarCarpeta(
  sitio: Sitio,
  carpetaUrl: string | null,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.sitios, sitio.id), {
    carpetaUrl,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'sitio',
        entidadId: sitio.id,
        sitioId: sitio.id,
        proyectoId: null,
        programaId: null,
        accion: 'actualizar',
        campo: 'carpetaUrl',
        valorAnterior: sitio.carpetaUrl,
        valorNuevo: carpetaUrl,
        detalle: null,
      },
    ],
    actor,
  )
  await batch.commit()
}

export async function existeSitio(id: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COLECCIONES.sitios, id))
  return snap.exists()
}
