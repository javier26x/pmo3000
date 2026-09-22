import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarUsuario } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import type { Usuario, UsuarioEditable } from '@/domain/tipos/usuario'
import type { Actor } from '@/domain/tipos/comunes'

const convertidor = crearConvertidor(normalizarUsuario)

export function refUsuario(uid: string) {
  return doc(db, COLECCIONES.usuarios, uid).withConverter(convertidor)
}

export async function obtenerUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(refUsuario(uid))
  return snap.exists() ? snap.data() : null
}

export function observarUsuario(
  uid: string,
  cb: (u: Usuario | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    refUsuario(uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => onError(e),
  )
}

export function observarUsuarios(
  cb: (u: Usuario[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLECCIONES.usuarios).withConverter(convertidor),
    orderBy('nombre'),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

/**
 * Alta del perfil en el primer ingreso. El rol NO se decide aqui: entra como
 * 'lector' y un administrador lo promueve. Las reglas impiden que el propio
 * usuario se cambie el rol.
 */
export async function asegurarPerfil(datos: {
  uid: string
  email: string
  nombre: string
}): Promise<void> {
  const ref = doc(db, COLECCIONES.usuarios, datos.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(ref, {
      email: datos.email.toLowerCase(),
      nombre: datos.nombre || datos.email,
      rol: 'lector',
      celulaId: null,
      proveedorId: null,
      activo: true,
      ultimoAcceso: serverTimestamp(),
      creadoEn: serverTimestamp(),
      creadoPor: datos.uid,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: datos.uid,
    })
    return
  }

  await updateDoc(ref, { ultimoAcceso: serverTimestamp() })
}

export async function actualizarUsuario(
  objetivo: Usuario,
  cambios: UsuarioEditable,
  actor: Actor,
): Promise<void> {
  const batch = writeBatch(db)

  batch.update(doc(db, COLECCIONES.usuarios, objetivo.id), {
    ...cambios,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  const campos: [keyof UsuarioEditable, string][] = [
    ['rol', 'rol'],
    ['celulaId', 'celulaId'],
    ['proveedorId', 'proveedorId'],
    ['activo', 'activo'],
    ['nombre', 'nombre'],
  ]

  agregarEventos(
    batch,
    campos
      .filter(([clave]) => String(objetivo[clave] ?? '') !== String(cambios[clave] ?? ''))
      .map(([clave, nombre]) => ({
        entidadTipo: 'usuario' as const,
        entidadId: objetivo.id,
        sitioId: null,
        proyectoId: null,
        programaId: null,
        accion: 'actualizar' as const,
        campo: nombre,
        valorAnterior: objetivo[clave] === null ? null : String(objetivo[clave]),
        valorNuevo: cambios[clave] === null ? null : String(cambios[clave]),
        detalle: null,
      })),
    actor,
  )

  await batch.commit()
}
