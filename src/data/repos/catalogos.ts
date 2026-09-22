/**
 * Catalogos: celulas, proveedores, portafolios, programas, proyectos y plantillas
 * de gates. Son pocos documentos y se necesitan en casi toda la app, asi que se
 * observan completos una vez y quedan en memoria.
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
import {
  normalizarCelula,
  normalizarGateTemplate,
  normalizarPortafolio,
  normalizarPrograma,
  normalizarProveedor,
  normalizarProyecto,
} from '../normalizadores'
import type {
  Celula,
  GateTemplate,
  Portafolio,
  Programa,
  Proveedor,
  Proyecto,
} from '@/domain/tipos'
import type { Actor } from '@/domain/tipos/comunes'
import type { TipoEntidad } from '@/domain/tipos/auditoria'

const convCelula = crearConvertidor(normalizarCelula)
const convProveedor = crearConvertidor(normalizarProveedor)
const convPortafolio = crearConvertidor(normalizarPortafolio)
const convPrograma = crearConvertidor(normalizarPrograma)
const convProyecto = crearConvertidor(normalizarProyecto)
const convPlantilla = crearConvertidor(normalizarGateTemplate)

function observar<T>(
  nombre: string,
  convertidor: ReturnType<typeof crearConvertidor<T & { id: string }>>,
  campoOrden: string,
  cb: (datos: (T & { id: string })[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, nombre).withConverter(convertidor), orderBy(campoOrden))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => onError(e),
  )
}

export const observarCelulas = (cb: (d: Celula[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.celulas, convCelula, 'nombre', cb, onError)

export const observarProveedores = (cb: (d: Proveedor[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.proveedores, convProveedor, 'nombre', cb, onError)

export const observarPortafolios = (cb: (d: Portafolio[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.portafolios, convPortafolio, 'nombre', cb, onError)

export const observarProgramas = (cb: (d: Programa[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.programas, convPrograma, 'nombre', cb, onError)

export const observarProyectos = (cb: (d: Proyecto[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.proyectos, convProyecto, 'nombre', cb, onError)

export const observarPlantillas = (cb: (d: GateTemplate[]) => void, onError: (e: Error) => void) =>
  observar(COLECCIONES.gateTemplates, convPlantilla, 'nombre', cb, onError)

// ---------------------------------------------------------------------------
// Escritura
//
// Los catálogos los administra un rol admin desde la pantalla de Configuración.
// Son pocos documentos y se crean de a uno, así que cada alta va con su evento
// de auditoría en el mismo writeBatch, igual que el resto de la app.
// ---------------------------------------------------------------------------

async function guardarCatalogo(
  coleccion: string,
  entidadTipo: TipoEntidad,
  id: string,
  datos: Record<string, unknown>,
  nombre: string,
  actor: Actor,
  esNuevo: boolean,
): Promise<string> {
  const batch = writeBatch(db)

  batch.set(
    doc(db, coleccion, id),
    {
      ...datos,
      ...(esNuevo ? { creadoEn: serverTimestamp(), creadoPor: actor.uid } : {}),
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )

  agregarEventos(
    batch,
    [
      {
        entidadTipo,
        entidadId: id,
        sitioId: null,
        proyectoId: entidadTipo === 'proyecto' ? id : null,
        programaId: entidadTipo === 'programa' ? id : null,
        accion: esNuevo ? 'crear' : 'actualizar',
        campo: null,
        valorAnterior: null,
        valorNuevo: nombre,
        detalle: null,
      },
    ],
    actor,
  )

  await batch.commit()
  return id
}

export async function existe(coleccion: string, id: string): Promise<boolean> {
  return (await getDoc(doc(db, coleccion, id))).exists()
}

export const guardarCelula = (
  id: string,
  datos: Pick<Celula, 'nombre' | 'descripcion' | 'color' | 'activa'>,
  actor: Actor,
  esNuevo: boolean,
) =>
  guardarCatalogo(
    COLECCIONES.celulas,
    'usuario',
    id,
    { ...datos, liderUid: null },
    datos.nombre,
    actor,
    esNuevo,
  )

export const guardarProveedor = (
  id: string,
  datos: Pick<Proveedor, 'nombre' | 'contactoNombre' | 'contactoEmail' | 'activo'>,
  actor: Actor,
  esNuevo: boolean,
) => guardarCatalogo(COLECCIONES.proveedores, 'usuario', id, datos, datos.nombre, actor, esNuevo)

export const guardarPortafolio = (
  id: string,
  datos: Pick<Portafolio, 'nombre' | 'descripcion' | 'periodo' | 'activo'>,
  actor: Actor,
  esNuevo: boolean,
) =>
  guardarCatalogo(
    COLECCIONES.portafolios,
    'programa',
    id,
    { ...datos, responsableUid: actor.uid },
    datos.nombre,
    actor,
    esNuevo,
  )

export const guardarPrograma = (
  id: string,
  datos: Pick<
    Programa,
    | 'portafolioId'
    | 'nombre'
    | 'descripcion'
    | 'gateTemplateId'
    | 'fechaInicio'
    | 'fechaFin'
    | 'estado'
    | 'color'
  >,
  actor: Actor,
  esNuevo: boolean,
) =>
  guardarCatalogo(
    COLECCIONES.programas,
    'programa',
    id,
    { ...datos, responsableUid: actor.uid },
    datos.nombre,
    actor,
    esNuevo,
  )

export const guardarProyecto = (
  id: string,
  datos: Pick<
    Proyecto,
    | 'programaId'
    | 'portafolioId'
    | 'nombre'
    | 'descripcion'
    | 'celulaId'
    | 'proveedorId'
    | 'fechaInicio'
    | 'fechaFin'
    | 'estado'
  >,
  actor: Actor,
  esNuevo: boolean,
) =>
  guardarCatalogo(
    COLECCIONES.proyectos,
    'proyecto',
    id,
    { ...datos, responsableUid: actor.uid },
    datos.nombre,
    actor,
    esNuevo,
  )

/**
 * Crea o actualiza una plantilla de gates.
 *
 * Sin al menos una plantilla, ningún sitio puede entrar en seguimiento: es el
 * primer documento que necesita una instalación nueva.
 */
export async function guardarPlantilla(
  plantilla: GateTemplate,
  actor: Actor,
  esNuevo: boolean,
): Promise<string> {
  const {
    id,
    creadoEn: _c,
    creadoPor: _cp,
    actualizadoEn: _a,
    actualizadoPor: _ap,
    ...datos
  } = plantilla
  return guardarCatalogo(
    COLECCIONES.gateTemplates,
    'gateTemplate',
    id,
    datos,
    plantilla.nombre,
    actor,
    esNuevo,
  )
}
