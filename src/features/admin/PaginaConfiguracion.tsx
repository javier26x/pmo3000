import { useState, type ReactNode } from 'react'
import {
  Building2,
  Check,
  Copy,
  FolderTree,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  Users2,
} from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  Campo,
  Casilla,
  Dialogo,
  Entrada,
  Insignia,
  Selector,
  type TonoInsignia,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import {
  APAGADO,
  contarReferencias,
  contarUsoPlantilla,
  desactivarCatalogo,
  eliminarCatalogo,
  eliminarPlantilla,
  guardarCelula,
  guardarEdicionPlantilla,
  guardarPortafolio,
  guardarPrograma,
  guardarProveedor,
  guardarProyecto,
  type TipoCatalogo,
} from '@/data/repos/catalogos'
import { PLANTILLA_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import { duplicarPlantilla, plantillaEnBlanco } from '@/domain/plantillas/edicion'
import { crearId, idDisponible } from '@/domain/tipos/identificadores'
import {
  ESTADOS_PROGRAMA,
  NOMBRES_ESTADO_PROGRAMA,
  type EstadoPrograma,
} from '@/domain/tipos/organizacion'
import type {
  Celula,
  GateTemplate,
  Portafolio,
  Programa,
  Proveedor,
  Proyecto,
} from '@/domain/tipos'
import type { Recurso } from '@/domain/permisos/matriz'
import type { ConteoReferencias } from '@/domain/catalogos/referencias'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { DialogoEliminar } from './DialogoEliminar'
import { EditorPlantilla } from './EditorPlantilla'
import { ProtegerSecuencias } from './ProtegerSecuencias'

/** Plantilla abierta en el editor. `original` null es un alta o un duplicado. */
interface EdicionPlantilla {
  original: GateTemplate | null
  inicial: GateTemplate
  /** Solo en altas: el id sale del nombre que se escriba. */
  idDesdeNombre: boolean
}

/** Un documento de catalogo junto con su tipo, para no perder cual es cual. */
type Elemento =
  | { tipo: 'celula'; item: Celula }
  | { tipo: 'proveedor'; item: Proveedor }
  | { tipo: 'portafolio'; item: Portafolio }
  | { tipo: 'programa'; item: Programa }
  | { tipo: 'proyecto'; item: Proyecto }

/** Alta (existente null) o edicion de un catalogo. */
type Edicion =
  | { tipo: 'celula'; existente: Celula | null }
  | { tipo: 'proveedor'; existente: Proveedor | null }
  | { tipo: 'portafolio'; existente: Portafolio | null }
  | { tipo: 'programa'; existente: Programa | null }
  | { tipo: 'proyecto'; existente: Proyecto | null }

const RECURSO: Record<TipoCatalogo, Recurso> = {
  celula: 'celulas',
  proveedor: 'proveedores',
  portafolio: 'portafolios',
  programa: 'programas',
  proyecto: 'proyectos',
}

const NOMBRE_TIPO: Record<TipoCatalogo, { singular: string; conArticulo: string }> = {
  celula: { singular: 'célula', conArticulo: 'la célula' },
  proveedor: { singular: 'proveedor', conArticulo: 'el proveedor' },
  portafolio: { singular: 'portafolio', conArticulo: 'el portafolio' },
  programa: { singular: 'programa', conArticulo: 'el programa' },
  proyecto: { singular: 'proyecto', conArticulo: 'el proyecto' },
}

const TONO_ESTADO: Record<EstadoPrograma, TonoInsignia> = {
  planificado: 'info',
  en_curso: 'ok',
  en_riesgo: 'riesgo',
  cerrado: 'neutro',
}

/** Esta activo o, en programas y proyectos, no cerrado. */
function estaActivo(e: Elemento): boolean {
  switch (e.tipo) {
    case 'celula':
      return e.item.activa
    case 'proveedor':
    case 'portafolio':
      return e.item.activo
    case 'programa':
    case 'proyecto':
      return e.item.estado !== 'cerrado'
  }
}

/** Valor actual del campo que se apaga al desactivar, para la auditoria. */
function valorApagable(e: Elemento): unknown {
  switch (e.tipo) {
    case 'celula':
      return e.item.activa
    case 'proveedor':
    case 'portafolio':
      return e.item.activo
    case 'programa':
    case 'proyecto':
      return e.item.estado
  }
}

/**
 * Configuración inicial y catálogos.
 *
 * Existe por un motivo concreto: una instalación nueva arranca con la base
 * vacía, y sin plantilla de gates ni programas no se puede importar ni un sitio.
 * Antes eso obligaba a escribir documentos a mano en la consola de Firebase —un
 * arreglo de gates con su checklist anidado, justo lo que peor se escribe a
 * mano—. Acá se hace con la sesión de administrador que ya existe y pasando por
 * las mismas reglas que todo lo demás.
 *
 * Cada catálogo se crea, se edita, se desactiva y, si nadie lo usa, se elimina
 * desde aquí: nada de esto debería requerir tocar la base a mano.
 */
export function PaginaConfiguracion() {
  const actor = useActor()
  const { puedeHacer } = useSesion()
  useTituloPagina('Configuración')
  const { cargando, celulas, proveedores, portafolios, programas, proyectos, plantillas } =
    useCatalogos()

  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [eliminando, setEliminando] = useState<Elemento | null>(null)
  const [creandoPlantilla, setCreandoPlantilla] = useState(false)
  const [editandoPlantilla, setEditandoPlantilla] = useState<EdicionPlantilla | null>(null)
  const [eliminandoPlantilla, setEliminandoPlantilla] = useState<GateTemplate | null>(null)

  const puedeEditarPlantillas = puedeHacer('gateTemplates', 'editar')
  const plantillaEstandar = plantillas.find((p) => p.id === PLANTILLA_ESTANDAR.id)
  const listo = plantillas.length > 0 && programas.length > 0 && proyectos.length > 0
  const idsPlantillas = new Set(plantillas.map((p) => p.id))
  const idNuevaPlantilla = (nombre: string) => idDisponible(crearId(nombre, 'plt'), idsPlantillas)

  // Crear la estandar pasa por el mismo guardado del editor, que comprueba en el
  // servidor que no exista ya (evita duplicarla desde dos pestañas).
  const crearPlantillaEstandar = () => {
    setCreandoPlantilla(true)
    guardarEdicionPlantilla(null, PLANTILLA_ESTANDAR, actor)
      .then((r) =>
        r.guardado ? avisar.ok('Se creó la plantilla estándar') : avisar.error(r.motivos.join(' ')),
      )
      .catch((e) => avisar.error(`No se pudo crear la plantilla: ${mensajeDeError(e)}`))
      .finally(() => setCreandoPlantilla(false))
  }

  // Restaurar la estandar sobre una que ya existe abre el editor con la
  // estandar cargada: asi se ven y se validan los cambios antes de pisar nada.
  const restaurarPlantillaEstandar = (actual: GateTemplate) =>
    setEditandoPlantilla({
      original: actual,
      inicial: {
        ...structuredClone(PLANTILLA_ESTANDAR),
        version: actual.version,
        activo: actual.activo,
        campos: actual.campos,
        homologacion: actual.homologacion,
      },
      idDesdeNombre: false,
    })

  /** Botones de editar y eliminar de una fila, segun lo que permite el rol. */
  const acciones = (e: Elemento, editar: () => void) => ({
    ...(puedeHacer(RECURSO[e.tipo], 'editar') ? { onEditar: editar } : {}),
    ...(puedeHacer(RECURSO[e.tipo], 'eliminar') ? { onEliminar: () => setEliminando(e) } : {}),
  })

  const insigniaActivo = (activo: boolean, femenino = false) =>
    activo ? undefined : { texto: femenino ? 'Inactiva' : 'Inactivo', tono: 'neutro' as const }

  const insigniaEstado = (estado: EstadoPrograma) => ({
    texto: NOMBRES_ESTADO_PROGRAMA[estado],
    tono: TONO_ESTADO[estado],
  })

  const botonAgregar = (tipo: TipoCatalogo, deshabilitado = false) =>
    puedeHacer(RECURSO[tipo], 'crear') ? (
      <Boton
        onClick={() => setEdicion({ tipo, existente: null } as Edicion)}
        disabled={cargando || deshabilitado}
        icono={<Plus aria-hidden className="size-4" />}
      >
        Agregar
      </Boton>
    ) : null

  return (
    <>
      <CabeceraPantalla
        titulo="Configuración"
        descripcion="La estructura sobre la que se cuelga el despliegue: plantilla de gates, portafolios, programas, proyectos, células y proveedores."
      />

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {!cargando && !listo && (
            <Aviso tono="info" titulo="Puesta en marcha">
              Para poder importar sitios hace falta, en este orden: la{' '}
              <strong>plantilla de gates</strong>, un <strong>portafolio</strong>, al menos un{' '}
              <strong>programa</strong> y al menos un <strong>proyecto</strong> dentro de ese
              programa. Las células y los proveedores se pueden agregar después.
            </Aviso>
          )}

          <Seccion
            icono={<ListChecks aria-hidden className="size-4" />}
            titulo="Plantillas de gates"
            descripcion="La secuencia de etapas de cada programa y el checklist exigible en cada una. Editar una plantilla crea una versión nueva, que rige para los sitios que entren desde ahora."
            accion={
              puedeEditarPlantillas ? (
                <span className="flex flex-wrap gap-2">
                  <Boton
                    variante={plantillaEstandar ? 'secundario' : 'primario'}
                    cargando={creandoPlantilla}
                    disabled={cargando}
                    onClick={() =>
                      plantillaEstandar
                        ? restaurarPlantillaEstandar(plantillaEstandar)
                        : crearPlantillaEstandar()
                    }
                    icono={
                      plantillaEstandar ? (
                        <Check aria-hidden className="size-4" />
                      ) : (
                        <Plus aria-hidden className="size-4" />
                      )
                    }
                  >
                    {plantillaEstandar ? 'Restaurar la estándar' : 'Crear la plantilla estándar'}
                  </Boton>
                  <Boton
                    disabled={cargando}
                    onClick={() =>
                      setEditandoPlantilla({
                        original: null,
                        inicial: plantillaEnBlanco('', ''),
                        idDesdeNombre: true,
                      })
                    }
                    icono={<Plus aria-hidden className="size-4" />}
                  >
                    Nueva plantilla
                  </Boton>
                </span>
              ) : null
            }
          >
            {cargando ? (
              <FilasEsqueleto />
            ) : plantillas.length === 0 ? (
              <Vacio>
                Todavía no hay ninguna plantilla. Sin ella, los sitios no pueden entrar en
                seguimiento.
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde">
                {plantillas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{p.nombre}</span>
                      <span className="ml-2 font-mono text-xs text-texto-3">{p.id}</span>
                    </span>
                    {!p.activo && <Insignia tono="neutro">Inactiva</Insignia>}
                    <Insignia tono="neutro">v{p.version}</Insignia>
                    <Insignia tono="info">{p.gates.length} etapas</Insignia>
                    <Insignia tono="neutro">
                      {p.gates.reduce((n, g) => n + g.checklist.length, 0)} entregables
                    </Insignia>
                    {puedeEditarPlantillas && (
                      <span className="flex items-center gap-1">
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          soloIcono
                          aria-label={`Editar ${p.nombre}`}
                          title="Editar"
                          onClick={() =>
                            setEditandoPlantilla({ original: p, inicial: p, idDesdeNombre: false })
                          }
                          icono={<Pencil aria-hidden className="size-3.5" />}
                        />
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          soloIcono
                          aria-label={`Duplicar ${p.nombre}`}
                          title="Duplicar"
                          onClick={() =>
                            setEditandoPlantilla({
                              original: null,
                              inicial: duplicarPlantilla(p, '', `${p.nombre} (copia)`),
                              idDesdeNombre: true,
                            })
                          }
                          icono={<Copy aria-hidden className="size-3.5" />}
                        />
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          soloIcono
                          aria-label={`Eliminar ${p.nombre}`}
                          title="Eliminar"
                          onClick={() => setEliminandoPlantilla(p)}
                          icono={<Trash2 aria-hidden className="size-3.5" />}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion
            icono={<FolderTree aria-hidden className="size-4" />}
            titulo="Portafolios"
            descripcion="El nivel más alto: agrupa los programas de un período."
            accion={botonAgregar('portafolio')}
          >
            <Lista
              cargando={cargando}
              items={portafolios.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: p.periodo,
                insignia: insigniaActivo(p.activo),
                ...acciones({ tipo: 'portafolio', item: p }, () =>
                  setEdicion({ tipo: 'portafolio', existente: p }),
                ),
              }))}
              vacio="Sin portafolios."
            />
          </Seccion>

          <Seccion
            icono={<Layers aria-hidden className="size-4" />}
            titulo="Programas"
            descripcion="Ej. «Plan 200 sitios nuevos». El nombre es el que se reconoce en la columna Programa al importar."
            accion={botonAgregar('programa', portafolios.length === 0 || plantillas.length === 0)}
          >
            <Lista
              cargando={cargando}
              items={programas.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: `${p.fechaInicio ?? 'sin inicio'} → ${p.fechaFin ?? 'sin fin'}`,
                insignia: insigniaEstado(p.estado),
                ...acciones({ tipo: 'programa', item: p }, () =>
                  setEdicion({ tipo: 'programa', existente: p }),
                ),
              }))}
              vacio={
                portafolios.length === 0
                  ? 'Crea primero un portafolio.'
                  : plantillas.length === 0
                    ? 'Crea primero la plantilla de gates.'
                    : 'Sin programas.'
              }
            />
          </Seccion>

          <Seccion
            icono={<Building2 aria-hidden className="size-4" />}
            titulo="Proyectos"
            descripcion="El tramo de un programa al que se incorporan los sitios. Un sitio entra al seguimiento a través de un proyecto."
            accion={botonAgregar('proyecto', programas.length === 0)}
          >
            <Lista
              cargando={cargando}
              items={proyectos.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: programas.find((pr) => pr.id === p.programaId)?.nombre ?? p.programaId,
                insignia: insigniaEstado(p.estado),
                ...acciones({ tipo: 'proyecto', item: p }, () =>
                  setEdicion({ tipo: 'proyecto', existente: p }),
                ),
              }))}
              vacio={programas.length === 0 ? 'Crea primero un programa.' : 'Sin proyectos.'}
            />
          </Seccion>

          <Seccion
            icono={<Users2 aria-hidden className="size-4" />}
            titulo="Células"
            descripcion="Los equipos de la PMO. Definen las columnas del kanban por célula."
            accion={botonAgregar('celula')}
          >
            <Lista
              cargando={cargando}
              items={celulas.map((c) => ({
                id: c.id,
                titulo: c.nombre,
                detalle: c.descripcion,
                insignia: insigniaActivo(c.activa, true),
                ...acciones({ tipo: 'celula', item: c }, () =>
                  setEdicion({ tipo: 'celula', existente: c }),
                ),
              }))}
              vacio="Sin células."
            />
          </Seccion>

          <Seccion
            icono={<Truck aria-hidden className="size-4" />}
            titulo="Proveedores"
            descripcion="Las empresas contratistas. Un usuario con rol contratista solo ve los sitios de su proveedor."
            accion={botonAgregar('proveedor')}
          >
            <Lista
              cargando={cargando}
              items={proveedores.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: p.contactoEmail,
                insignia: insigniaActivo(p.activo),
                ...acciones({ tipo: 'proveedor', item: p }, () =>
                  setEdicion({ tipo: 'proveedor', existente: p }),
                ),
              }))}
              vacio="Sin proveedores."
            />
          </Seccion>

          {actor.rol === 'admin' && (
            <Seccion
              icono={<ShieldCheck aria-hidden className="size-4" />}
              titulo="Seguridad de la secuencia"
              descripcion="Mantenimiento de una vez para los seguimientos anteriores a la protección de etapas."
              accion={null}
            >
              <ProtegerSecuencias actor={actor} />
            </Seccion>
          )}
        </div>
      </div>

      {edicion && (
        <DialogoCatalogo
          key={`${edicion.tipo}:${edicion.existente?.id ?? 'nuevo'}`}
          edicion={edicion}
          onCerrar={() => setEdicion(null)}
          catalogos={{ celulas, proveedores, portafolios, programas, proyectos, plantillas }}
          actor={actor}
        />
      )}

      {eliminando && (
        <DialogoEliminar
          key={`${eliminando.tipo}:${eliminando.item.id}`}
          titulo={`Eliminar ${NOMBRE_TIPO[eliminando.tipo].singular}`}
          etiquetaEliminar={`Eliminar ${NOMBRE_TIPO[eliminando.tipo].singular}`}
          nombre={eliminando.item.nombre}
          queEs={NOMBRE_TIPO[eliminando.tipo].conArticulo}
          verificar={() => contarReferencias(eliminando.tipo, eliminando.item.id)}
          eliminar={() =>
            eliminarCatalogo(eliminando.tipo, eliminando.item.id, eliminando.item.nombre, actor)
          }
          alternativa={alternativaSegura(eliminando, actor)}
          onCerrar={() => setEliminando(null)}
        />
      )}

      {editandoPlantilla && (
        <EditorPlantilla
          key={editandoPlantilla.original?.id ?? 'nueva'}
          original={editandoPlantilla.original}
          inicial={editandoPlantilla.inicial}
          generarId={editandoPlantilla.idDesdeNombre ? idNuevaPlantilla : undefined}
          actor={actor}
          onCerrar={() => setEditandoPlantilla(null)}
        />
      )}

      {eliminandoPlantilla && (
        <DialogoEliminar
          key={eliminandoPlantilla.id}
          titulo="Eliminar plantilla"
          etiquetaEliminar="Eliminar plantilla"
          nombre={eliminandoPlantilla.nombre}
          queEs="la plantilla"
          verificar={() => contarUsoPlantilla(eliminandoPlantilla.id)}
          eliminar={() =>
            eliminarPlantilla(eliminandoPlantilla.id, eliminandoPlantilla.nombre, actor)
          }
          alternativa={(referencias) =>
            desactivarPlantillaSegura(eliminandoPlantilla, referencias, actor)
          }
          sinAlternativa={
            eliminandoPlantilla.activo
              ? 'Hay sitios en seguimiento creados con ella: sus etapas toman el nombre y el color de esta plantilla, así que tampoco se puede desactivar. Se podrá eliminar cuando esos sitios y los programas que la usan pasen a otra plantilla.'
              : 'Ya está desactivada. Para eliminarla, primero asigna otra plantilla a los programas que la usan.'
          }
          onCerrar={() => setEliminandoPlantilla(null)}
        />
      )}
    </>
  )
}

/** Desactivar (o cerrar) en vez de borrar, cuando el catalogo esta en uso. */
function alternativaSegura(e: Elemento, actor: Parameters<typeof desactivarCatalogo>[3]) {
  if (!estaActivo(e)) return null
  const { conArticulo } = NOMBRE_TIPO[e.tipo]
  const cierra = APAGADO[e.tipo].campo === 'estado'
  return {
    etiqueta: cierra ? 'Marcar como cerrado' : 'Desactivar',
    explicacion: cierra
      ? `Marcar ${conArticulo} como cerrado no borra nada: lo que ya lo usa queda intacto y se puede reabrir editando su estado.`
      : `Desactivar ${conArticulo} no borra nada: lo que ya lo usa queda intacto y se puede volver a activar editándolo.`,
    ejecutar: () => {
      desactivarCatalogo(e.tipo, e.item.id, valorApagable(e), actor).catch((err) =>
        avisar.error(`No se pudo desactivar «${e.item.nombre}»: ${mensajeDeError(err)}`),
      )
      avisar.ok(cierra ? `«${e.item.nombre}» quedó cerrado` : `«${e.item.nombre}» quedó inactivo`)
    },
  }
}

/**
 * Desactivar una plantilla en uso, solo si ningun sitio se creo con ella: las
 * vistas que cruzan programas toman nombre y color de las plantillas activas,
 * y un sitio con su plantilla inactiva quedaria con etapas grises sin nombre.
 */
function desactivarPlantillaSegura(
  p: GateTemplate,
  referencias: ConteoReferencias,
  actor: Parameters<typeof guardarEdicionPlantilla>[2],
) {
  if (!p.activo || (referencias.sitioProyectos ?? 0) > 0) return null
  return {
    etiqueta: 'Desactivar',
    explicacion:
      'Desactivarla no borra nada: deja de ofrecerse al crear programas y los que ya la tienen asignada siguen igual. Se puede volver a activar desde el editor.',
    ejecutar: () => {
      guardarEdicionPlantilla(p, { ...p, activo: false }, actor)
        .then((r) =>
          r.guardado
            ? avisar.ok(`«${p.nombre}» quedó inactiva`)
            : avisar.error(`No se pudo desactivar «${p.nombre}»: ${r.motivos.join(' ')}`),
        )
        .catch((e) => avisar.error(`No se pudo desactivar «${p.nombre}»: ${mensajeDeError(e)}`))
    },
  }
}

function Seccion({
  icono,
  titulo,
  descripcion,
  accion,
  children,
}: {
  icono: ReactNode
  titulo: string
  descripcion: string
  accion: ReactNode
  children: ReactNode
}) {
  return (
    // El nombre accesible hace que cada bloque sea una región navegable con
    // lector de pantalla, en vez de un muro de encabezados sueltos.
    <section
      aria-label={titulo}
      className="overflow-hidden rounded-lg border border-borde bg-superficie"
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-borde px-3 py-2.5">
        <span className="mt-0.5 text-texto-3">{icono}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-md">{titulo}</h2>
          <p className="mt-0.5 text-xs text-texto-2">{descripcion}</p>
        </div>
        {accion}
      </header>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-sm text-texto-3">{children}</p>
}

function FilasEsqueleto() {
  return (
    <ul aria-busy="true" aria-label="Cargando" className="divide-y divide-borde">
      {[40, 56, 32].map((ancho) => (
        <li key={ancho} className="flex items-center gap-2 px-3 py-2">
          <span className="esqueleto block h-3.5 rounded" style={{ width: `${ancho}%` }} />
          <span className="esqueleto ml-auto block h-3.5 w-16 rounded" />
        </li>
      ))}
    </ul>
  )
}

interface ItemLista {
  id: string
  titulo: string
  detalle: string
  insignia?: { texto: string; tono: TonoInsignia } | undefined
  onEditar?: () => void
  onEliminar?: () => void
}

function Lista({
  items,
  vacio,
  cargando = false,
}: {
  items: ItemLista[]
  vacio: string
  cargando?: boolean
}) {
  // Mientras llegan los catalogos no se muestra el estado vacio: haria creer
  // que no hay nada y tentaria a crear duplicados.
  if (cargando) return <FilasEsqueleto />
  if (items.length === 0) return <Vacio>{vacio}</Vacio>
  return (
    <ul className="divide-y divide-borde">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5">
          <span className="text-sm font-medium">{item.titulo}</span>
          <span className="font-mono text-xs text-texto-3">{item.id}</span>
          {item.insignia && <Insignia tono={item.insignia.tono}>{item.insignia.texto}</Insignia>}
          <span className="ml-auto flex min-w-0 items-center gap-1">
            {item.detalle && (
              <span className="mr-1 truncate text-xs text-texto-2">{item.detalle}</span>
            )}
            {item.onEditar && (
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label={`Editar ${item.titulo}`}
                title="Editar"
                onClick={item.onEditar}
                icono={<Pencil aria-hidden className="size-3.5" />}
              />
            )}
            {item.onEliminar && (
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label={`Eliminar ${item.titulo}`}
                title="Eliminar"
                onClick={item.onEliminar}
                icono={<Trash2 aria-hidden className="size-3.5" />}
              />
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface CatalogosDelDialogo {
  celulas: Celula[]
  proveedores: Proveedor[]
  portafolios: Portafolio[]
  programas: Programa[]
  proyectos: Proyecto[]
  plantillas: GateTemplate[]
}

const PREFIJOS: Record<TipoCatalogo, string> = {
  celula: 'cel',
  proveedor: 'prov',
  portafolio: 'port',
  programa: 'prog',
  proyecto: 'proy',
}

const TITULOS_ALTA: Record<TipoCatalogo, string> = {
  celula: 'Nueva célula',
  proveedor: 'Nuevo proveedor',
  portafolio: 'Nuevo portafolio',
  programa: 'Nuevo programa',
  proyecto: 'Nuevo proyecto',
}

/**
 * Alta y edición de cualquier catálogo. Un solo diálogo con los campos que
 * cambian, en vez de diez casi idénticos: lo único distinto entre ellos son dos
 * o tres campos. Se monta al abrir, así el estado inicial sale del documento que
 * se edita (o vacío, en un alta).
 */
function DialogoCatalogo({
  edicion,
  onCerrar,
  catalogos,
  actor,
}: {
  edicion: Edicion
  onCerrar: () => void
  catalogos: CatalogosDelDialogo
  actor: Parameters<typeof guardarCelula>[2]
}) {
  const { tipo } = edicion
  const esNuevo = edicion.existente === null
  // Vistas tipadas del documento que se edita (null en un alta o si es otro tipo).
  const celula = edicion.tipo === 'celula' ? edicion.existente : null
  const proveedor = edicion.tipo === 'proveedor' ? edicion.existente : null
  const portafolio = edicion.tipo === 'portafolio' ? edicion.existente : null
  const programa = edicion.tipo === 'programa' ? edicion.existente : null
  const proyecto = edicion.tipo === 'proyecto' ? edicion.existente : null

  const [nombre, setNombre] = useState(edicion.existente?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(
    celula?.descripcion ??
      portafolio?.descripcion ??
      programa?.descripcion ??
      proyecto?.descripcion ??
      '',
  )
  const [periodo, setPeriodo] = useState(portafolio?.periodo ?? String(new Date().getFullYear()))
  const [portafolioId, setPortafolioId] = useState(programa?.portafolioId ?? '')
  const [programaId, setProgramaId] = useState(proyecto?.programaId ?? '')
  const [celulaId, setCelulaId] = useState(proyecto?.celulaId ?? '')
  const [proveedorId, setProveedorId] = useState(proyecto?.proveedorId ?? '')
  const [plantillaId, setPlantillaId] = useState(programa?.gateTemplateId ?? '')
  const [fechaInicio, setFechaInicio] = useState<string>(
    programa?.fechaInicio ?? proyecto?.fechaInicio ?? '',
  )
  const [fechaFin, setFechaFin] = useState<string>(programa?.fechaFin ?? proyecto?.fechaFin ?? '')
  const [estado, setEstado] = useState<EstadoPrograma>(
    programa?.estado ?? proyecto?.estado ?? 'en_curso',
  )
  const [activo, setActivo] = useState(
    celula?.activa ?? proveedor?.activo ?? portafolio?.activo ?? true,
  )
  const [contactoNombre, setContactoNombre] = useState(proveedor?.contactoNombre ?? '')
  const [contactoEmail, setContactoEmail] = useState(proveedor?.contactoEmail ?? '')
  const [error, setError] = useState<string | null>(null)

  const usados = new Set(
    (tipo === 'celula'
      ? catalogos.celulas
      : tipo === 'proveedor'
        ? catalogos.proveedores
        : tipo === 'portafolio'
          ? catalogos.portafolios
          : tipo === 'programa'
            ? catalogos.programas
            : catalogos.proyectos
    ).map((x) => x.id),
  )

  // Al editar, el id no cambia aunque cambie el nombre: va en las rutas, en la
  // auditoría y en las referencias de otros documentos.
  const id = edicion.existente?.id ?? idDisponible(crearId(nombre, PREFIJOS[tipo]), usados)
  const programaElegido = catalogos.programas.find((p) => p.id === programaId)

  // En las opciones solo se ofrece lo activo, más el valor que ya tenía el
  // documento (para no perderlo en silencio al abrir la edición).
  const portafoliosOfrecidos = catalogos.portafolios.filter(
    (p) => p.activo || p.id === portafolioId,
  )
  const programasOfrecidos = catalogos.programas.filter(
    (p) => p.estado !== 'cerrado' || p.id === programaId,
  )
  const celulasOfrecidas = catalogos.celulas.filter((c) => c.activa || c.id === celulaId)
  const proveedoresOfrecidos = catalogos.proveedores.filter((p) => p.activo || p.id === proveedorId)

  const faltaAlgo =
    nombre.trim() === '' ||
    (tipo === 'programa' && (portafolioId === '' || plantillaId === '')) ||
    (tipo === 'proyecto' && programaId === '')

  const guardar = () => {
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      setError('La fecha de término es anterior a la de inicio. Corrige una de las dos.')
      return
    }
    if (tipo === 'proyecto' && !programaElegido) {
      setError('El programa elegido ya no existe. Elige otro de la lista.')
      return
    }

    const comun = { nombre: nombre.trim(), descripcion: descripcion.trim() }
    let promesa: Promise<string>

    switch (edicion.tipo) {
      case 'celula':
        promesa = guardarCelula(
          id,
          { ...comun, color: edicion.existente?.color ?? 'neutro', activa: activo },
          actor,
          esNuevo,
          edicion.existente ?? undefined,
        )
        break
      case 'proveedor':
        promesa = guardarProveedor(
          id,
          {
            nombre: comun.nombre,
            contactoNombre: contactoNombre.trim(),
            contactoEmail: contactoEmail.trim(),
            activo,
          },
          actor,
          esNuevo,
          edicion.existente ?? undefined,
        )
        break
      case 'portafolio':
        promesa = guardarPortafolio(
          id,
          { ...comun, periodo: periodo.trim(), activo },
          actor,
          esNuevo,
          edicion.existente ?? undefined,
        )
        break
      case 'programa':
        promesa = guardarPrograma(
          id,
          {
            ...comun,
            portafolioId,
            gateTemplateId: plantillaId,
            fechaInicio: fechaInicio || null,
            fechaFin: fechaFin || null,
            estado,
            color: edicion.existente?.color ?? 'neutro',
          },
          actor,
          esNuevo,
          edicion.existente ?? undefined,
        )
        break
      case 'proyecto':
        promesa = guardarProyecto(
          id,
          {
            ...comun,
            programaId,
            portafolioId: programaElegido?.portafolioId ?? '',
            celulaId: celulaId || null,
            proveedorId: proveedorId || null,
            fechaInicio: fechaInicio || null,
            fechaFin: fechaFin || null,
            estado,
          },
          actor,
          esNuevo,
          edicion.existente ?? undefined,
        )
        break
    }

    // Igual que en el resto de la app: no se espera la confirmación del
    // servidor, que sin señal no llega nunca. Si el servidor lo rechaza, el
    // aviso de error explica por qué.
    promesa.catch((e) => avisar.error(`No se pudo guardar «${comun.nombre}»: ${mensajeDeError(e)}`))
    avisar.ok(esNuevo ? `Se creó «${comun.nombre}»` : `Cambios guardados en «${comun.nombre}»`)
    onCerrar()
  }

  const titulo = esNuevo ? TITULOS_ALTA[tipo] : `Editar ${NOMBRE_TIPO[tipo].singular}`

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={
        !esNuevo
          ? `Identificador ${id}. No cambia al renombrar.`
          : nombre.trim()
            ? `Se guardará con el identificador ${id}`
            : undefined
      }
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" disabled={faltaAlgo} onClick={guardar}>
            {esNuevo ? `Crear ${NOMBRE_TIPO[tipo].singular}` : 'Guardar cambios'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Aviso tono="error">{error}</Aviso>}

        <Campo
          etiqueta="Nombre"
          htmlFor="cfg-nombre"
          obligatorio
          ayuda={
            tipo === 'programa'
              ? esNuevo
                ? 'Este es el nombre que la importación busca en la columna Programa.'
                : 'La importación busca este nombre en la columna Programa: si lo cambias, actualiza también tus planillas.'
              : undefined
          }
        >
          <Entrada
            id="cfg-nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>

        {tipo !== 'proveedor' && (
          <Campo etiqueta="Descripción" htmlFor="cfg-desc">
            <Entrada
              id="cfg-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
        )}

        {tipo === 'portafolio' && (
          <Campo etiqueta="Período" htmlFor="cfg-periodo">
            <Entrada
              id="cfg-periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </Campo>
        )}

        {tipo === 'proveedor' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Contacto" htmlFor="cfg-contacto">
              <Entrada
                id="cfg-contacto"
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Correo de contacto" htmlFor="cfg-correo">
              <Entrada
                id="cfg-correo"
                type="email"
                value={contactoEmail}
                onChange={(e) => setContactoEmail(e.target.value)}
              />
            </Campo>
          </div>
        )}

        {tipo === 'programa' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Portafolio"
              htmlFor="cfg-portafolio"
              obligatorio
              ayuda={
                esNuevo
                  ? undefined
                  : 'No se cambia al editar: sus proyectos y sitios llevan copiado el portafolio.'
              }
            >
              <Selector
                id="cfg-portafolio"
                value={portafolioId}
                disabled={!esNuevo}
                onChange={(e) => setPortafolioId(e.target.value)}
              >
                <option value="">Elige uno…</option>
                {portafoliosOfrecidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo
              etiqueta="Plantilla de gates"
              htmlFor="cfg-plantilla"
              obligatorio
              ayuda={
                esNuevo
                  ? 'Se copia en cada sitio que entre a este programa.'
                  : 'Se copia al incorporar un sitio: cambiarla solo afecta a los sitios que entren desde ahora.'
              }
            >
              <Selector
                id="cfg-plantilla"
                value={plantillaId}
                onChange={(e) => setPlantillaId(e.target.value)}
              >
                <option value="">Elige una…</option>
                {catalogos.plantillas
                  .filter((p) => p.activo || p.id === plantillaId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </Selector>
            </Campo>
          </div>
        )}

        {tipo === 'proyecto' && (
          <>
            <Campo
              etiqueta="Programa"
              htmlFor="cfg-programa"
              obligatorio
              ayuda={
                esNuevo
                  ? undefined
                  : 'No se cambia al editar: cada sitio en seguimiento lleva copiado su programa.'
              }
            >
              <Selector
                id="cfg-programa"
                value={programaId}
                disabled={!esNuevo}
                onChange={(e) => setProgramaId(e.target.value)}
              >
                <option value="">Elige uno…</option>
                {programasOfrecidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Célula"
                htmlFor="cfg-celula"
                ayuda={
                  esNuevo ? undefined : 'Se aplica a los sitios que se incorporen desde ahora.'
                }
              >
                <Selector
                  id="cfg-celula"
                  value={celulaId}
                  onChange={(e) => setCelulaId(e.target.value)}
                >
                  <option value="">Sin célula</option>
                  {celulasOfrecidas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo
                etiqueta="Proveedor"
                htmlFor="cfg-proveedor"
                ayuda={
                  esNuevo ? undefined : 'Se aplica a los sitios que se incorporen desde ahora.'
                }
              >
                <Selector
                  id="cfg-proveedor"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                >
                  <option value="">Sin proveedor</option>
                  {proveedoresOfrecidos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
          </>
        )}

        {(tipo === 'programa' || tipo === 'proyecto') && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Fecha de inicio"
                htmlFor="cfg-inicio"
                ayuda="Desde aquí se encadenan las fechas plan de cada gate."
              >
                <Entrada
                  id="cfg-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Fecha de término" htmlFor="cfg-fin">
                <Entrada
                  id="cfg-fin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </Campo>
            </div>
            <Campo
              etiqueta="Estado"
              htmlFor="cfg-estado"
              ayuda="Cerrado equivale a desactivado: conserva su historia y sus sitios."
            >
              <Selector
                id="cfg-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoPrograma)}
              >
                {ESTADOS_PROGRAMA.map((e) => (
                  <option key={e} value={e}>
                    {NOMBRES_ESTADO_PROGRAMA[e]}
                  </option>
                ))}
              </Selector>
            </Campo>
          </>
        )}

        {(tipo === 'celula' || tipo === 'proveedor' || tipo === 'portafolio') && (
          <Casilla
            etiqueta={
              tipo === 'celula'
                ? 'Célula activa'
                : `${tipo === 'proveedor' ? 'Proveedor' : 'Portafolio'} activo`
            }
            descripcion="Desactivar no borra nada: deja de ofrecerse como opción en esta pantalla y lo que ya lo usa queda intacto."
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
        )}
      </div>
    </Dialogo>
  )
}
