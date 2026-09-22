/**
 * Invitaciones: un admin deja listo el perfil de alguien antes de su primer
 * ingreso y le manda el enlace para entrar. Ver domain/tipos/invitacion.ts.
 */
import {
  collection,
  doc,
  getDoc,
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
import { normalizarInvitacion } from '../normalizadores'
import { enviarEnlaceInvitacion } from '../autenticacion'
import { normalizarAlcance } from '@/domain/permisos/alcance'
import { normalizarEmail } from '@/domain/permisos/dominio'
import type { Invitacion } from '@/domain/tipos/invitacion'
import type { Actor } from '@/domain/tipos/comunes'

const convertidor = crearConvertidor(normalizarInvitacion)

export function observarInvitaciones(
  cb: (lista: Invitacion[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLECCIONES.invitaciones).withConverter(convertidor),
      orderBy('invitadoEn', 'desc'),
    ),
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

/** La invitacion de un correo, o null. El invitado puede leer solo la suya. */
export async function leerInvitacion(email: string): Promise<Invitacion | null> {
  const snap = await getDoc(
    doc(db, COLECCIONES.invitaciones, normalizarEmail(email)).withConverter(convertidor),
  )
  return snap.exists() ? snap.data() : null
}

export type DatosInvitacion = Pick<
  Invitacion,
  'email' | 'nombre' | 'rol' | 'celulaId' | 'proveedorId' | 'alcance'
>

function evento(email: string, accion: 'crear' | 'actualizar', detalle: string) {
  return {
    entidadTipo: 'usuario' as const,
    entidadId: email,
    sitioId: null,
    proyectoId: null,
    programaId: null,
    accion,
    campo: 'invitacion',
    valorAnterior: null,
    valorNuevo: email,
    detalle,
  }
}

/**
 * Crea (o renueva) la invitacion y envia el enlace de ingreso al correo.
 * El documento va primero: si el correo no sale, la invitacion queda y se
 * puede reenviar.
 */
export async function invitar(datos: DatosInvitacion, actor: Actor): Promise<void> {
  const email = normalizarEmail(datos.email)
  const batch = writeBatch(db)
  batch.set(doc(db, COLECCIONES.invitaciones, email), {
    email,
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    celulaId: datos.celulaId,
    proveedorId: datos.rol === 'contratista' ? datos.proveedorId : null,
    // Un admin nunca queda acotado.
    alcance: normalizarAlcance(datos.rol === 'admin' ? null : datos.alcance),
    estado: 'pendiente',
    invitadoPor: actor.uid,
    invitadoEn: serverTimestamp(),
    aceptadaEn: null,
  })
  agregarEventos(batch, [evento(email, 'crear', `Invitado como ${datos.rol}`)], actor)
  await batch.commit()
  await enviarEnlaceInvitacion(email)
}

/** Vuelve a mandar el enlace (por ejemplo, si el correo se perdio). */
export async function reenviarInvitacion(inv: Invitacion): Promise<void> {
  await enviarEnlaceInvitacion(inv.email)
}

/** Revocar quita el acceso a un externo aunque ya haya entrado. */
export async function revocarInvitacion(inv: Invitacion, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, COLECCIONES.invitaciones, inv.id), { estado: 'revocada' })
  agregarEventos(batch, [evento(inv.email, 'actualizar', 'Invitación revocada')], actor)
  await batch.commit()
}
