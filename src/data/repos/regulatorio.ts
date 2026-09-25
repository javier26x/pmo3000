/**
 * Expediente legal y regulatorio de los sitios al aire: `regulatorio/{spId}`.
 *
 * Un documento por seguimiento, con el mismo id. Nace la primera vez que
 * alguien marca un documento: antes de eso el sitio ya esta en el proceso
 * (esta al aire), solo que con todo pendiente. Ver domain/regulatorio.
 */
import {
  and,
  collection,
  doc,
  onSnapshot,
  or,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import {
  crearConvertidor,
  enumerado,
  enumeradoNulo,
  fechaISO,
  instante,
  texto,
  textoNulo,
} from '../convertidores'
import { agregarEventos } from '../auditoria'
import { planAlcance } from '@/domain/permisos/alcance'
import {
  ESTADOS_DOCUMENTO,
  MODALIDADES,
  NOMBRES_ESTADO_DOCUMENTO,
  NOMBRES_MODALIDAD,
  type EstadoItemRegulatorio,
  type Modalidad,
  type RegistroRegulatorio,
} from '@/domain/regulatorio'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { Actor } from '@/domain/tipos/comunes'

function normalizarItem(valor: unknown): EstadoItemRegulatorio {
  const d = (valor ?? {}) as Record<string, unknown>
  return {
    estado: enumerado(d.estado, ESTADOS_DOCUMENTO, 'pendiente'),
    fecha: fechaISO(d.fecha),
    referencia: texto(d.referencia),
    obs: texto(d.obs),
    url: texto(d.url),
    por: textoNulo(d.por),
    en: instante(d.en),
  }
}

export function normalizarRegistroRegulatorio(id: string, d: DocumentData): RegistroRegulatorio {
  const items: Record<string, EstadoItemRegulatorio> = {}
  if (d.items && typeof d.items === 'object') {
    for (const [clave, valor] of Object.entries(d.items as Record<string, unknown>)) {
      items[clave] = normalizarItem(valor)
    }
  }
  return {
    id,
    sitioId: texto(d.sitioId),
    proyectoId: texto(d.proyectoId),
    programaId: texto(d.programaId),
    celulaId: textoNulo(d.celulaId),
    modalidad: enumeradoNulo(d.modalidad, MODALIDADES),
    items,
    actualizadoEn: instante(d.actualizadoEn),
    actualizadoPor: textoNulo(d.actualizadoPor),
  }
}

const convertidor = crearConvertidor(normalizarRegistroRegulatorio)

/**
 * La consulta que las reglas aceptan para este actor. Igual que con los
 * seguimientos, Firestore evalua la CONSULTA: un usuario con alcance tiene que
 * pedir solo lo de su alcance o la consulta entera falla.
 */
function consultaVisible(
  actor: Pick<Actor, 'rol' | 'proveedorId' | 'alcance'>,
  proyectoId: string | null,
): Query<RegistroRegulatorio> | null {
  const base = collection(db, COLECCIONES.regulatorio).withConverter(convertidor)
  const igualdades = proyectoId ? { proyectoId } : {}
  const filtros = proyectoId ? [where('proyectoId', '==', proyectoId)] : []
  const plan = planAlcance(actor, igualdades)
  if (plan.tipo === 'vacio') return null
  if (plan.tipo === 'sinRestriccion') return query(base, ...filtros)
  const enAlcance = or(...plan.disyunciones.map((d) => where(d.campo, 'in', d.valores)))
  return query(base, and(...filtros, enAlcance))
}

export function observarRegulatorio(
  actor: Actor,
  proyectoId: string | null,
  cb: (datos: RegistroRegulatorio[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  // El contratista no ve el expediente: es trabajo de la PMO con los organismos.
  const q = actor.rol === 'contratista' ? null : consultaVisible(actor, proyectoId)
  if (!q) {
    queueMicrotask(() => cb([]))
    return () => {}
  }
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export function observarRegistroRegulatorio(
  id: string,
  cb: (dato: RegistroRegulatorio | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLECCIONES.regulatorio, id).withConverter(convertidor),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => onError(e),
  )
}

/**
 * Lo que identifica al seguimiento. Viaja en cada escritura, no solo al crear:
 * las reglas lo comparan con el seguimiento para que nadie cuelgue un
 * expediente de un proyecto que no es suyo, y si el sitio cambio de celula el
 * expediente la sigue.
 */
function identidad(sp: SitioProyecto) {
  return {
    sitioId: sp.sitioId,
    proyectoId: sp.proyectoId,
    programaId: sp.programaId,
    celulaId: sp.celulaId,
  }
}

export type CambioItem = Pick<
  EstadoItemRegulatorio,
  'estado' | 'fecha' | 'referencia' | 'obs' | 'url'
>

export async function guardarItemRegulatorio(
  sp: SitioProyecto,
  itemId: string,
  nombreItem: string,
  cambio: CambioItem,
  anterior: EstadoItemRegulatorio,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  // set con merge fusiona el mapa `items`: toca solo este documento y crea el
  // expediente si es la primera marca.
  batch.set(
    doc(db, COLECCIONES.regulatorio, sp.id),
    {
      ...identidad(sp),
      items: {
        [itemId]: {
          ...cambio,
          url: cambio.url.trim(),
          referencia: cambio.referencia.trim(),
          por: actor.uid,
          en: serverTimestamp(),
        },
      },
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'sitioProyecto',
        entidadId: sp.id,
        sitioId: sp.sitioId,
        proyectoId: sp.proyectoId,
        programaId: sp.programaId,
        accion: 'checklist',
        campo: `regulatorio.${itemId}`,
        valorAnterior: NOMBRES_ESTADO_DOCUMENTO[anterior.estado],
        valorNuevo: NOMBRES_ESTADO_DOCUMENTO[cambio.estado],
        detalle: `Regulatorio · ${nombreItem}${cambio.referencia.trim() ? ` · ${cambio.referencia.trim()}` : ''}`,
      },
    ],
    actor,
  )
  await batch.commit()
}

export async function cambiarModalidad(
  sp: SitioProyecto,
  modalidad: Modalidad | null,
  anterior: Modalidad,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(db, COLECCIONES.regulatorio, sp.id),
    {
      ...identidad(sp),
      modalidad,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'sitioProyecto',
        entidadId: sp.id,
        sitioId: sp.sitioId,
        proyectoId: sp.proyectoId,
        programaId: sp.programaId,
        accion: 'actualizar',
        campo: 'regulatorio.modalidad',
        valorAnterior: NOMBRES_MODALIDAD[anterior],
        valorNuevo: modalidad ? NOMBRES_MODALIDAD[modalidad] : 'Según el tracker',
        detalle: 'Regulatorio',
      },
    ],
    actor,
  )
  await batch.commit()
}
