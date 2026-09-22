import { useState, type ReactNode } from 'react'
import { Building2, Check, FolderTree, Layers, ListChecks, Plus, Truck, Users2 } from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  Campo,
  Dialogo,
  Entrada,
  Insignia,
  Selector,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import {
  guardarCelula,
  guardarPlantilla,
  guardarPortafolio,
  guardarPrograma,
  guardarProveedor,
  guardarProyecto,
} from '@/data/repos/catalogos'
import { PLANTILLA_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import { crearId, idDisponible } from '@/domain/tipos/identificadores'
import { ESTADOS_PROGRAMA } from '@/domain/tipos/organizacion'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'

type Formulario = 'celula' | 'proveedor' | 'portafolio' | 'programa' | 'proyecto' | null

/**
 * Configuración inicial y catálogos.
 *
 * Existe por un motivo concreto: una instalación nueva arranca con la base
 * vacía, y sin plantilla de gates ni programas no se puede importar ni un sitio.
 * Antes eso obligaba a escribir documentos a mano en la consola de Firebase —un
 * arreglo de gates con su checklist anidado, justo lo que peor se escribe a
 * mano—. Acá se hace con la sesión de administrador que ya existe y pasando por
 * las mismas reglas que todo lo demás.
 */
export function PaginaConfiguracion() {
  const actor = useActor()
  useTituloPagina('Configuración')
  const { celulas, proveedores, portafolios, programas, proyectos, plantillas } = useCatalogos()

  const [formulario, setFormulario] = useState<Formulario>(null)
  const [creandoPlantilla, setCreandoPlantilla] = useState(false)

  const plantillaEstandar = plantillas.find((p) => p.id === PLANTILLA_ESTANDAR.id)
  const listo = plantillas.length > 0 && programas.length > 0 && proyectos.length > 0

  const crearPlantillaEstandar = () => {
    setCreandoPlantilla(true)
    guardarPlantilla(PLANTILLA_ESTANDAR, actor, !plantillaEstandar)
      .then(() => avisar.ok('Plantilla de gates creada'))
      .catch((e) => avisar.error(mensajeDeError(e)))
      .finally(() => setCreandoPlantilla(false))
  }

  return (
    <>
      <CabeceraPantalla
        titulo="Configuración"
        descripcion="La estructura sobre la que se cuelga el despliegue: plantilla de gates, portafolios, programas, proyectos, células y proveedores."
      />

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {!listo && (
            <Aviso tono="info" titulo="Puesta en marcha">
              Para poder importar sitios hace falta, en este orden: la{' '}
              <strong>plantilla de gates</strong>, un <strong>portafolio</strong>, al menos un{' '}
              <strong>programa</strong> y al menos un <strong>proyecto</strong> dentro de ese
              programa. Las células y los proveedores se pueden agregar después.
            </Aviso>
          )}

          <Seccion
            icono={<ListChecks aria-hidden className="size-4" />}
            titulo="Plantilla de gates"
            descripcion="Define la secuencia TSSR → FC → RFI → Implementación → D+1 → D+7 → SSV y el checklist exigible en cada uno."
            accion={
              <Boton
                variante={plantillaEstandar ? 'secundario' : 'primario'}
                cargando={creandoPlantilla}
                onClick={crearPlantillaEstandar}
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
            }
          >
            {plantillas.length === 0 ? (
              <Vacio>
                Todavía no hay ninguna plantilla. Sin ella, los sitios no pueden entrar en
                seguimiento.
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde">
                {plantillas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{p.nombre}</span>
                      <span className="ml-2 font-mono text-xs text-texto-3">{p.id}</span>
                    </span>
                    <Insignia tono="neutro">v{p.version}</Insignia>
                    <Insignia tono="info">{p.gates.length} gates</Insignia>
                    <Insignia tono="neutro">
                      {p.gates.reduce((n, g) => n + g.checklist.length, 0)} entregables
                    </Insignia>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion
            icono={<FolderTree aria-hidden className="size-4" />}
            titulo="Portafolios"
            descripcion="El nivel más alto: agrupa los programas de un período."
            accion={
              <Boton
                onClick={() => setFormulario('portafolio')}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            }
          >
            <Lista
              items={portafolios.map((p) => ({ id: p.id, titulo: p.nombre, detalle: p.periodo }))}
              vacio="Sin portafolios."
            />
          </Seccion>

          <Seccion
            icono={<Layers aria-hidden className="size-4" />}
            titulo="Programas"
            descripcion="Ej. «Plan 200 sitios nuevos». El nombre es el que se reconoce en la columna Programa al importar."
            accion={
              <Boton
                onClick={() => setFormulario('programa')}
                disabled={portafolios.length === 0 || plantillas.length === 0}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            }
          >
            <Lista
              items={programas.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: `${p.fechaInicio ?? 'sin inicio'} → ${p.fechaFin ?? 'sin fin'}`,
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
            accion={
              <Boton
                onClick={() => setFormulario('proyecto')}
                disabled={programas.length === 0}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            }
          >
            <Lista
              items={proyectos.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: programas.find((pr) => pr.id === p.programaId)?.nombre ?? p.programaId,
              }))}
              vacio={programas.length === 0 ? 'Crea primero un programa.' : 'Sin proyectos.'}
            />
          </Seccion>

          <Seccion
            icono={<Users2 aria-hidden className="size-4" />}
            titulo="Células"
            descripcion="Los equipos de la PMO. Definen las columnas del kanban por célula."
            accion={
              <Boton
                onClick={() => setFormulario('celula')}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            }
          >
            <Lista
              items={celulas.map((c) => ({ id: c.id, titulo: c.nombre, detalle: c.descripcion }))}
              vacio="Sin células."
            />
          </Seccion>

          <Seccion
            icono={<Truck aria-hidden className="size-4" />}
            titulo="Proveedores"
            descripcion="Las empresas contratistas. Un usuario con rol contratista solo ve los sitios de su proveedor."
            accion={
              <Boton
                onClick={() => setFormulario('proveedor')}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            }
          >
            <Lista
              items={proveedores.map((p) => ({
                id: p.id,
                titulo: p.nombre,
                detalle: p.contactoEmail,
              }))}
              vacio="Sin proveedores."
            />
          </Seccion>
        </div>
      </div>

      <DialogoAlta
        formulario={formulario}
        onCerrar={() => setFormulario(null)}
        catalogos={{ celulas, proveedores, portafolios, programas, plantillas }}
        actor={actor}
      />
    </>
  )
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

function Lista({
  items,
  vacio,
}: {
  items: { id: string; titulo: string; detalle: string }[]
  vacio: string
}) {
  if (items.length === 0) return <Vacio>{vacio}</Vacio>
  return (
    <ul className="divide-y divide-borde">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-baseline gap-2 px-3 py-2">
          <span className="text-sm font-medium">{item.titulo}</span>
          <span className="font-mono text-xs text-texto-3">{item.id}</span>
          {item.detalle && (
            <span className="ml-auto truncate text-xs text-texto-2">{item.detalle}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

interface CatalogosDelDialogo {
  celulas: { id: string; nombre: string }[]
  proveedores: { id: string; nombre: string }[]
  portafolios: { id: string; nombre: string }[]
  programas: { id: string; nombre: string; portafolioId: string }[]
  plantillas: { id: string; nombre: string }[]
}

const PREFIJOS: Record<Exclude<Formulario, null>, string> = {
  celula: 'cel',
  proveedor: 'prov',
  portafolio: 'port',
  programa: 'prog',
  proyecto: 'proy',
}

const TITULOS: Record<Exclude<Formulario, null>, string> = {
  celula: 'Nueva célula',
  proveedor: 'Nuevo proveedor',
  portafolio: 'Nuevo portafolio',
  programa: 'Nuevo programa',
  proyecto: 'Nuevo proyecto',
}

/**
 * Alta de cualquier catálogo. Un solo diálogo con los campos que cambian, en vez
 * de cinco casi idénticos: lo único distinto entre ellos son dos o tres campos.
 */
function DialogoAlta({
  formulario,
  onCerrar,
  catalogos,
  actor,
}: {
  formulario: Formulario
  onCerrar: () => void
  catalogos: CatalogosDelDialogo
  actor: Parameters<typeof guardarCelula>[2]
}) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [periodo, setPeriodo] = useState(String(new Date().getFullYear()))
  const [portafolioId, setPortafolioId] = useState('')
  const [programaId, setProgramaId] = useState('')
  const [celulaId, setCelulaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [plantillaId, setPlantillaId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!formulario) return null

  const usados = new Set(
    formulario === 'celula'
      ? catalogos.celulas.map((x) => x.id)
      : formulario === 'proveedor'
        ? catalogos.proveedores.map((x) => x.id)
        : formulario === 'portafolio'
          ? catalogos.portafolios.map((x) => x.id)
          : catalogos.programas.map((x) => x.id),
  )

  const id = idDisponible(crearId(nombre, PREFIJOS[formulario]), usados)
  const programaElegido = catalogos.programas.find((p) => p.id === programaId)

  const faltaAlgo =
    nombre.trim() === '' ||
    (formulario === 'programa' && (portafolioId === '' || plantillaId === '')) ||
    (formulario === 'proyecto' && programaId === '')

  const limpiar = () => {
    setNombre('')
    setDescripcion('')
    setContactoNombre('')
    setContactoEmail('')
    setFechaInicio('')
    setFechaFin('')
    setError(null)
  }

  const guardar = () => {
    const comun = { nombre: nombre.trim(), descripcion: descripcion.trim() }
    let promesa: Promise<string>

    switch (formulario) {
      case 'celula':
        promesa = guardarCelula(id, { ...comun, color: 'neutro', activa: true }, actor, true)
        break
      case 'proveedor':
        promesa = guardarProveedor(
          id,
          {
            nombre: comun.nombre,
            contactoNombre: contactoNombre.trim(),
            contactoEmail: contactoEmail.trim(),
            activo: true,
          },
          actor,
          true,
        )
        break
      case 'portafolio':
        promesa = guardarPortafolio(
          id,
          { ...comun, periodo: periodo.trim(), activo: true },
          actor,
          true,
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
            estado: ESTADOS_PROGRAMA[1],
            color: 'neutro',
          },
          actor,
          true,
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
            estado: ESTADOS_PROGRAMA[1],
          },
          actor,
          true,
        )
        break
    }

    // Igual que en el resto de la app: no se espera la confirmación del
    // servidor, que sin señal no llega nunca.
    promesa.catch((e) => setError(mensajeDeError(e)))
    avisar.ok(
      `${TITULOS[formulario].replace('Nuevo ', '').replace('Nueva ', '')} «${comun.nombre}» creada`,
    )
    limpiar()
    onCerrar()
  }

  return (
    <Dialogo
      abierto
      onCerrar={() => {
        limpiar()
        onCerrar()
      }}
      titulo={TITULOS[formulario]}
      descripcion={nombre.trim() ? `Se guardará con el identificador ${id}` : undefined}
      pie={
        <>
          <Boton
            onClick={() => {
              limpiar()
              onCerrar()
            }}
          >
            Cancelar
          </Boton>
          <Boton variante="primario" disabled={faltaAlgo} onClick={guardar}>
            Crear
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
            formulario === 'programa'
              ? 'Este es el nombre que la importación busca en la columna Programa.'
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

        {formulario !== 'proveedor' && (
          <Campo etiqueta="Descripción" htmlFor="cfg-desc">
            <Entrada
              id="cfg-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
        )}

        {formulario === 'portafolio' && (
          <Campo etiqueta="Período" htmlFor="cfg-periodo">
            <Entrada
              id="cfg-periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </Campo>
        )}

        {formulario === 'proveedor' && (
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

        {formulario === 'programa' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Portafolio" htmlFor="cfg-portafolio" obligatorio>
              <Selector
                id="cfg-portafolio"
                value={portafolioId}
                onChange={(e) => setPortafolioId(e.target.value)}
              >
                <option value="">Elige uno…</option>
                {catalogos.portafolios.map((p) => (
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
              ayuda="Se copia en cada sitio que entre a este programa."
            >
              <Selector
                id="cfg-plantilla"
                value={plantillaId}
                onChange={(e) => setPlantillaId(e.target.value)}
              >
                <option value="">Elige una…</option>
                {catalogos.plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
        )}

        {formulario === 'proyecto' && (
          <>
            <Campo etiqueta="Programa" htmlFor="cfg-programa" obligatorio>
              <Selector
                id="cfg-programa"
                value={programaId}
                onChange={(e) => setProgramaId(e.target.value)}
              >
                <option value="">Elige uno…</option>
                {catalogos.programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Célula" htmlFor="cfg-celula">
                <Selector
                  id="cfg-celula"
                  value={celulaId}
                  onChange={(e) => setCelulaId(e.target.value)}
                >
                  <option value="">Sin célula</option>
                  {catalogos.celulas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Proveedor" htmlFor="cfg-proveedor">
                <Selector
                  id="cfg-proveedor"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                >
                  <option value="">Sin proveedor</option>
                  {catalogos.proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
          </>
        )}

        {(formulario === 'programa' || formulario === 'proyecto') && (
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
        )}
      </div>
    </Dialogo>
  )
}
