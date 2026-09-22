import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { normalizarUsuario } from '../normalizadores'
import { agregarEventos } from '../auditoria'
import type { Usuario, UsuarioEditable } from '@/domain/tipos/usuario'
import { normalizarAlcance, serializarAlcance } from '@/domain/permisos/alcance'
import type { Actor, Rol } from '@/domain/tipos/comunes'
import { leerInvitacion } from './invitaciones'

/** El correo no es del dominio ni tiene invitacion vigente. */
export class AccesoDenegado extends Error {}

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
 * Alta del perfil en el primer ingreso.
 *
 * El rol entra como 'lector' salvo que el correo esté en la lista de
 * administradores externos (ver src/domain/permisos/dominio.ts), que existe para
 * resolver el arranque: alguien tiene que poder administrar la instalación antes
 * de que exista el primer administrador.
 *
 * Las reglas de Firestore validan exactamente lo mismo, así que esto no es una
 * puerta: un correo fuera de esa lista que intente crearse como admin es
 * rechazado por el servidor.
 */
export async function asegurarPerfil(datos: {
  uid: string
  email: string
  nombre: string
  rolInicial: Rol
  /** Correo del dominio o de la lista de administradores. */
  permitidoPorDominio: boolean
}): Promise<void> {
  const email = datos.email.toLowerCase()
  // La invitacion se lee siempre: para un correo externo es lo unico que lo
  // deja entrar, y para uno del dominio trae el rol y la celula ya asignados.
  // El administrador inicial no la necesita.
  const invitacion =
    datos.rolInicial === 'admin' ? null : await leerInvitacion(email).catch(() => null)
  const vigente = invitacion !== null && invitacion.estado !== 'revocada' ? invitacion : null
  if (!datos.permitidoPorDominio && vigente === null) {
    throw new AccesoDenegado(
      invitacion?.estado === 'revocada'
        ? `La invitación de ${email} fue revocada. Pide a un administrador que te vuelva a invitar.`
        : `${email} no tiene acceso a PMO3000. Pide a un administrador que te invite.`,
    )
  }

  const ref = doc(db, COLECCIONES.usuarios, datos.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const batch = writeBatch(db)
    batch.set(ref, {
      email,
      nombre: vigente?.nombre || datos.nombre || email,
      rol: vigente?.rol ?? datos.rolInicial,
      celulaId: vigente?.celulaId ?? null,
      proveedorId: vigente?.proveedorId ?? null,
      // Sin invitacion, sin restriccion: el alcance lo asigna un admin, nunca
      // el propio usuario. Con invitacion, el que dejo el admin.
      alcance: vigente?.alcance ?? { celulas: [], programas: [], proyectos: [] },
      activo: true,
      ultimoAcceso: serverTimestamp(),
      creadoEn: serverTimestamp(),
      creadoPor: datos.uid,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: datos.uid,
    })
    if (vigente?.estado === 'pendiente') {
      batch.update(doc(db, COLECCIONES.invitaciones, email), {
        estado: 'aceptada',
        aceptadaEn: serverTimestamp(),
        uid: datos.uid,
      })
    }
    await batch.commit()
    return
  }

  // El perfil ya existe. Si la cuenta está en la lista de administradores pero el
  // documento quedó con un rol menor, se corrige acá. Pasa de verdad: basta que
  // el primer ingreso ocurra con un cliente desplegado antes de agregar el correo
  // a la lista, y esa persona queda como lector sin nadie que pueda promoverla,
  // porque promover es cosa de un admin. Las reglas permiten esta corrección solo
  // para los correos de su propia lista.
  const actual = snap.data()
  if (datos.rolInicial === 'admin' && actual?.['rol'] !== 'admin') {
    await updateDoc(ref, {
      rol: 'admin',
      ultimoAcceso: serverTimestamp(),
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

  // Un admin nunca queda acotado (las reglas lo dejan pasar igual), asi que al
  // promover a alguien se le limpia el alcance para que el perfil no diga una
  // cosa y las reglas hagan otra.
  const alcance =
    cambios.rol === 'admin' ? normalizarAlcance(null) : normalizarAlcance(cambios.alcance)

  batch.update(doc(db, COLECCIONES.usuarios, objetivo.id), {
    ...cambios,
    alcance,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })

  const campos: [Exclude<keyof UsuarioEditable, 'alcance'>, string][] = [
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

  // El alcance es una lista: se audita como texto estable (ver
  // serializarAlcance), con "Todo" para la ausencia de restriccion.
  const alcanceAnterior = serializarAlcance(objetivo.alcance)
  const alcanceNuevo = serializarAlcance(alcance)
  if (alcanceAnterior !== alcanceNuevo) {
    agregarEventos(
      batch,
      [
        {
          entidadTipo: 'usuario',
          entidadId: objetivo.id,
          sitioId: null,
          proyectoId: null,
          programaId: null,
          accion: 'actualizar',
          campo: 'alcance',
          valorAnterior: alcanceAnterior,
          valorNuevo: alcanceNuevo,
          detalle: null,
        },
      ],
      actor,
    )
  }

  await batch.commit()
}
