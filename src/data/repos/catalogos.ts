/**
 * Catalogos: celulas, proveedores, portafolios, programas, proyectos y plantillas
 * de gates. Son pocos documentos y se necesitan en casi toda la app, asi que se
 * observan completos una vez y quedan en memoria.
 */
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { crearConvertidor } from '../convertidores'
import { agregarEventos } from '../auditoria'
import { aTextoAuditoria } from '@/domain/tipos/auditoria'
import {
  REFERENCIAS,
  sumarConteos,
  totalReferencias,
  type ConteoReferencias,
  type TipoEliminable,
} from '@/domain/catalogos/referencias'
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
import {
  analizarCambios,
  evaluarImpacto,
  hayCambios,
  prepararGuardado,
  resumirCambios,
  secuenciaLegible,
  validarPlantilla,
} from '@/domain/plantillas/edicion'

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

/**
 * Valores previos de un documento que se edita. Con ellos la auditoria registra
 * campo por campo que cambio, igual que la edicion del maestro de sitios.
 */
type Anterior = Readonly<Record<string, unknown>>

async function guardarCatalogo(
  coleccion: string,
  entidadTipo: TipoEntidad,
  id: string,
  datos: Record<string, unknown>,
  nombre: string,
  actor: Actor,
  esNuevo: boolean,
  anterior?: Anterior,
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

  const contexto = {
    entidadTipo,
    entidadId: id,
    sitioId: null,
    proyectoId: entidadTipo === 'proyecto' ? id : null,
    programaId: entidadTipo === 'programa' ? id : null,
  }

  const cambios =
    !esNuevo && anterior
      ? Object.keys(datos).filter(
          (clave) => aTextoAuditoria(anterior[clave]) !== aTextoAuditoria(datos[clave]),
        )
      : []

  agregarEventos(
    batch,
    cambios.length > 0 && anterior
      ? cambios.map((clave) => ({
          ...contexto,
          accion: 'actualizar' as const,
          campo: clave,
          valorAnterior: aTextoAuditoria(anterior[clave]),
          valorNuevo: aTextoAuditoria(datos[clave]),
          detalle: coleccion,
        }))
      : [
          {
            ...contexto,
            accion: esNuevo ? ('crear' as const) : ('actualizar' as const),
            campo: null,
            valorAnterior: null,
            valorNuevo: nombre,
            detalle: esNuevo ? null : coleccion,
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

// Los campos de responsable (liderUid, responsableUid) se fijan solo al crear:
// editar el nombre de un programa no debe cambiar quien es su responsable.

export const guardarCelula = (
  id: string,
  datos: Pick<Celula, 'nombre' | 'descripcion' | 'color' | 'activa'>,
  actor: Actor,
  esNuevo: boolean,
  anterior?: Celula,
) =>
  guardarCatalogo(
    COLECCIONES.celulas,
    'usuario',
    id,
    esNuevo ? { ...datos, liderUid: null } : datos,
    datos.nombre,
    actor,
    esNuevo,
    anterior,
  )

export const guardarProveedor = (
  id: string,
  datos: Pick<Proveedor, 'nombre' | 'contactoNombre' | 'contactoEmail' | 'activo'>,
  actor: Actor,
  esNuevo: boolean,
  anterior?: Proveedor,
) =>
  guardarCatalogo(
    COLECCIONES.proveedores,
    'usuario',
    id,
    datos,
    datos.nombre,
    actor,
    esNuevo,
    anterior,
  )

export const guardarPortafolio = (
  id: string,
  datos: Pick<Portafolio, 'nombre' | 'descripcion' | 'periodo' | 'activo'>,
  actor: Actor,
  esNuevo: boolean,
  anterior?: Portafolio,
) =>
  guardarCatalogo(
    COLECCIONES.portafolios,
    'programa',
    id,
    esNuevo ? { ...datos, responsableUid: actor.uid } : datos,
    datos.nombre,
    actor,
    esNuevo,
    anterior,
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
  anterior?: Programa,
) =>
  guardarCatalogo(
    COLECCIONES.programas,
    'programa',
    id,
    esNuevo ? { ...datos, responsableUid: actor.uid } : datos,
    datos.nombre,
    actor,
    esNuevo,
    anterior,
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
  anterior?: Proyecto,
) =>
  guardarCatalogo(
    COLECCIONES.proyectos,
    'proyecto',
    id,
    esNuevo ? { ...datos, responsableUid: actor.uid } : datos,
    datos.nombre,
    actor,
    esNuevo,
    anterior,
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

// ---------------------------------------------------------------------------
// Eliminacion y desactivacion
//
// Firestore no tiene claves foraneas: un borrado nunca falla por estar en uso,
// simplemente deja huerfanos a quienes apuntaban al documento. Por eso todo
// borrado pasa antes por contarReferencias() y, si algo lo usa, no se ejecuta.
// Lo que esta en uso se desactiva, que conserva el historial intacto.
// ---------------------------------------------------------------------------

/**
 * Cuenta, en el servidor, cuantos documentos apuntan a `id`. Cuesta una lectura
 * por consulta (no por documento). Sin conexion falla: es a proposito, porque
 * la cache local puede no tener todo y un "no hay nada" falso terminaria en un
 * borrado que deja huerfanos.
 */
export async function contarReferencias(
  tipo: TipoEliminable,
  id: string,
): Promise<ConteoReferencias> {
  const partes = await Promise.all(
    REFERENCIAS[tipo].map(async ({ coleccion, campo }) => {
      const snap = await getCountFromServer(
        query(collection(db, COLECCIONES[coleccion]), where(campo, '==', id)),
      )
      return { coleccion, cantidad: snap.data().count }
    }),
  )
  return sumarConteos(partes)
}

export type TipoCatalogo = Exclude<TipoEliminable, 'sitio'>

const DESTINO: Record<TipoCatalogo, { coleccion: string; entidadTipo: TipoEntidad }> = {
  // celulas y proveedores se auditan como 'usuario' y portafolios como
  // 'programa', igual que en el alta: el log no tiene un tipo propio para ellos.
  celula: { coleccion: COLECCIONES.celulas, entidadTipo: 'usuario' },
  proveedor: { coleccion: COLECCIONES.proveedores, entidadTipo: 'usuario' },
  portafolio: { coleccion: COLECCIONES.portafolios, entidadTipo: 'programa' },
  programa: { coleccion: COLECCIONES.programas, entidadTipo: 'programa' },
  proyecto: { coleccion: COLECCIONES.proyectos, entidadTipo: 'proyecto' },
}

/**
 * Como se "apaga" cada catalogo. Programas y proyectos no tienen un campo activo:
 * su estado 'cerrado' cumple ese papel (dejan de ofrecerse, pero su historia
 * sigue ahi).
 */
export const APAGADO: Record<TipoCatalogo, { campo: string; valor: boolean | 'cerrado' }> = {
  celula: { campo: 'activa', valor: false },
  proveedor: { campo: 'activo', valor: false },
  portafolio: { campo: 'activo', valor: false },
  programa: { campo: 'estado', valor: 'cerrado' },
  proyecto: { campo: 'estado', valor: 'cerrado' },
}

export type ResultadoEliminacion =
  { eliminado: true } | { eliminado: false; referencias: ConteoReferencias }

/**
 * Borra un catalogo SOLO si nadie lo usa. Vuelve a contar las referencias justo
 * antes de borrar (la pantalla pudo haber quedado abierta un rato), y el borrado
 * va con su evento de auditoria en el mismo batch.
 *
 * Limite conocido: entre el conteo y el commit pasan milisegundos en que otro
 * usuario podria asignar el catalogo. Cerrarlo del todo exige validarlo del lado
 * del servidor (Fase 2, Cloud Functions).
 */
export async function eliminarCatalogo(
  tipo: TipoCatalogo,
  id: string,
  nombre: string,
  actor: Actor,
): Promise<ResultadoEliminacion> {
  const referencias = await contarReferencias(tipo, id)
  if (totalReferencias(referencias) > 0) return { eliminado: false, referencias }

  const { coleccion, entidadTipo } = DESTINO[tipo]
  const batch = writeBatch(db)
  batch.delete(doc(db, coleccion, id))
  agregarEventos(
    batch,
    [
      {
        entidadTipo,
        entidadId: id,
        sitioId: null,
        proyectoId: tipo === 'proyecto' ? id : null,
        programaId: tipo === 'programa' ? id : null,
        accion: 'eliminar',
        campo: null,
        valorAnterior: nombre,
        valorNuevo: null,
        detalle: coleccion,
      },
    ],
    actor,
  )
  await batch.commit()
  return { eliminado: true }
}

/**
 * Desactiva (o cierra, en programas y proyectos) un catalogo en uso.
 * `valorAnterior` es el valor actual del campo, para la auditoria.
 */
export async function desactivarCatalogo(
  tipo: TipoCatalogo,
  id: string,
  valorAnterior: unknown,
  actor: Actor,
): Promise<void> {
  const { coleccion, entidadTipo } = DESTINO[tipo]
  const { campo, valor } = APAGADO[tipo]
  const batch = writeBatch(db)
  batch.update(doc(db, coleccion, id), {
    [campo]: valor,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: actor.uid,
  })
  agregarEventos(
    batch,
    [
      {
        entidadTipo,
        entidadId: id,
        sitioId: null,
        proyectoId: tipo === 'proyecto' ? id : null,
        programaId: tipo === 'programa' ? id : null,
        accion: 'actualizar',
        campo,
        valorAnterior: aTextoAuditoria(valorAnterior),
        valorNuevo: aTextoAuditoria(valor),
        detalle: coleccion,
      },
    ],
    actor,
  )
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Editor de plantillas
//
// Una plantilla en uso no se reescribe a ciegas: los seguimientos llevan copiada
// la version con que se crearon, pero la maquina de gates y las vistas que
// cruzan programas leen la vigente. Ver domain/plantillas/edicion.ts para que
// cambio es seguro y cual no.
// ---------------------------------------------------------------------------

/**
 * Quien usa una plantilla: programas que la tienen asignada y sitios en
 * seguimiento creados con ella. Consulta al servidor, igual que
 * contarReferencias(): sin conexion falla en vez de contestar "nada".
 */
export async function contarUsoPlantilla(id: string): Promise<ConteoReferencias> {
  const [programas, sitioProyectos] = await Promise.all(
    (['programas', 'sitioProyectos'] as const).map(async (coleccion) => {
      const snap = await getCountFromServer(
        query(collection(db, COLECCIONES[coleccion]), where('gateTemplateId', '==', id)),
      )
      return { coleccion, cantidad: snap.data().count }
    }),
  )
  return sumarConteos([programas!, sitioProyectos!])
}

export type ResultadoGuardadoPlantilla =
  { guardado: true; version: number } | { guardado: false; motivos: string[] }

/**
 * Guarda una plantilla desde el editor. `original` es la plantilla tal como
 * estaba al abrir el editor (null en un alta o un duplicado).
 *
 * Antes de escribir vuelve a comprobar, contra el servidor:
 * - que nadie haya guardado otra version mientras el editor estaba abierto;
 * - cuantos seguimientos la usan, para bloquear lo que los romperia.
 *
 * Sube la version si algo cambio y deja el rastro en el mismo batch. Limite
 * conocido, igual que en eliminarCatalogo(): entre la comprobacion y el commit
 * pasan milisegundos sin proteccion (Fase 2, Cloud Functions).
 */
export async function guardarEdicionPlantilla(
  original: GateTemplate | null,
  editada: GateTemplate,
  actor: Actor,
): Promise<ResultadoGuardadoPlantilla> {
  const ref = doc(db, COLECCIONES.gateTemplates, editada.id)
  const actual = await getDocFromServer(ref)

  if (original === null && actual.exists()) {
    return {
      guardado: false,
      motivos: [`Ya existe una plantilla con el identificador ${editada.id}. Cambia el nombre.`],
    }
  }
  if (original !== null) {
    if (!actual.exists()) {
      return {
        guardado: false,
        motivos: ['La plantilla ya no existe: alguien la eliminó. Cierra el editor.'],
      }
    }
    const versionActual = normalizarGateTemplate(actual.id, actual.data()).version
    if (versionActual !== original.version) {
      return {
        guardado: false,
        motivos: [
          `Alguien guardó la versión ${versionActual} mientras editabas. Cierra el editor y vuelve a abrirlo para partir de esa versión.`,
        ],
      }
    }
  }

  const lista = prepararGuardado(original, editada)
  const errores = validarPlantilla(lista)
  if (errores.length > 0) return { guardado: false, motivos: errores }

  const cambios = original ? analizarCambios(original, lista) : null
  if (original && cambios && !hayCambios(cambios)) return { guardado: true, version: lista.version }

  if (original && cambios) {
    const uso = await contarUsoPlantilla(original.id)
    const { bloqueos } = evaluarImpacto(cambios, uso.sitioProyectos ?? 0)
    if (bloqueos.length > 0) return { guardado: false, motivos: bloqueos }
  }

  const {
    id,
    creadoEn: _c,
    creadoPor: _cp,
    actualizadoEn: _a,
    actualizadoPor: _ap,
    ...datos
  } = lista

  const batch = writeBatch(db)
  // merge conserva creadoEn/creadoPor; los arreglos (gates, campos) se
  // reemplazan completos, que es lo que se quiere.
  batch.set(
    ref,
    {
      ...datos,
      ...(original === null ? { creadoEn: serverTimestamp(), creadoPor: actor.uid } : {}),
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )

  const contexto = {
    entidadTipo: 'gateTemplate' as const,
    entidadId: id,
    sitioId: null,
    proyectoId: null,
    programaId: null,
  }
  agregarEventos(
    batch,
    original && cambios
      ? [
          {
            ...contexto,
            accion: 'actualizar',
            campo: 'version',
            valorAnterior: `v${original.version} · ${secuenciaLegible(original)}`,
            valorNuevo: `v${lista.version} · ${secuenciaLegible(lista)}`,
            detalle: resumirCambios(cambios).join('; ').slice(0, 1500),
          },
        ]
      : [
          {
            ...contexto,
            accion: 'crear',
            campo: null,
            valorAnterior: null,
            valorNuevo: lista.nombre,
            detalle: secuenciaLegible(lista),
          },
        ],
    actor,
  )

  await batch.commit()
  return { guardado: true, version: lista.version }
}

/**
 * Borra una plantilla SOLO si ningun programa la tiene asignada y ningun sitio
 * se creo con ella. Recuenta justo antes de borrar.
 */
export async function eliminarPlantilla(
  id: string,
  nombre: string,
  actor: Actor,
): Promise<ResultadoEliminacion> {
  const referencias = await contarUsoPlantilla(id)
  if (totalReferencias(referencias) > 0) return { eliminado: false, referencias }

  const batch = writeBatch(db)
  batch.delete(doc(db, COLECCIONES.gateTemplates, id))
  agregarEventos(
    batch,
    [
      {
        entidadTipo: 'gateTemplate',
        entidadId: id,
        sitioId: null,
        proyectoId: null,
        programaId: null,
        accion: 'eliminar',
        campo: null,
        valorAnterior: nombre,
        valorNuevo: null,
        detalle: COLECCIONES.gateTemplates,
      },
    ],
    actor,
  )
  await batch.commit()
  return { eliminado: true }
}
