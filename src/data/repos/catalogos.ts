/**
 * Catalogos: celulas, proveedores, portafolios, programas, proyectos y plantillas
 * de gates. Son pocos documentos y se necesitan en casi toda la app, asi que se
 * observan completos una vez y quedan en memoria.
 */
import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
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
