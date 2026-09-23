import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import {
  ClipboardCheck,
  FileSpreadsheet,
  Info,
  KeyRound,
  Pencil,
  Timer,
  Upload,
} from 'lucide-react'
import {
  Boton,
  CabeceraPantalla,
  Cargando,
  EnlaceBoton,
  EstadoVacio,
  Insignia,
  Metrica,
  Selector,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { guardarArea } from '@/data/repos/areas'
import { guardarResponsableProyecto } from '@/data/repos/catalogos'
import { SelectorPersonas } from '@/features/admin/EditorArea'
import { EditorSla, etapasDelProyecto } from '@/features/admin/EditorSla'
import { DialogoCatalogo } from '@/features/admin/PaginaConfiguracion'
import { formatearFecha } from '@/domain/fechas'
import { nombreGate } from '@/domain/gates/catalogo'
import { estaEnAlcance, tieneAlcance } from '@/domain/permisos/alcance'
import { NOMBRES_ROL } from '@/domain/tipos/comunes'
import { NOMBRES_ESTADO_PROGRAMA, type Area, type Proyecto } from '@/domain/tipos'
import { resumirProyecto } from '@/domain/vistas/proyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useMedidorSla } from '@/hooks/useSla'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { Bloque, TONO_ESTADO } from './comun'

/**
 * Ficha de un proyecto: todo lo que se configura de el en un solo lugar.
 *
 * Antes esto estaba repartido: los datos en un dialogo de Configuracion, el SLA
 * en otro y quien revisa dentro de cada area. Aca se ve y se edita junto, y
 * cada cosa se sigue guardando donde siempre (el proyecto, sus areas), asi que
 * Configuracion y Pendientes ven lo mismo.
 */
export function PaginaProyecto() {
  const { proyectoId = '' } = useParams()
  const catalogos = useCatalogos()
  const { cargando: cargandoCatalogos, proyectos } = catalogos
  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? null
  useTituloPagina(proyecto?.nombre ?? 'Proyecto')

  if (cargandoCatalogos) return <Cargando texto="Abriendo el proyecto…" />
  if (proyecto === null) {
    return (
      <EstadoVacio
        titulo="No existe ese proyecto"
        descripcion="Puede que lo hayan eliminado o que el enlace esté incompleto."
        accion={<EnlaceBoton to="/proyectos">Ver proyectos</EnlaceBoton>}
      />
    )
  }
  return <FichaProyecto proyecto={proyecto} />
}

function FichaProyecto({ proyecto }: { proyecto: Proyecto }) {
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const catalogos = useCatalogos()
  const {
    programas,
    plantillas,
    celulas,
    areas,
    usuarios,
    etapas,
    nombrePrograma,
    nombreCelula,
    nombreProveedor,
    nombreUsuario,
    plantillaPorId,
  } = catalogos
  const { seguimientos, hoy, cargando, truncado } = useDespliegue()
  const medirSla = useMedidorSla()
  const [editandoDatos, setEditandoDatos] = useState(false)
  const [editandoSla, setEditandoSla] = useState(false)

  const puedeEditar = puedeHacer('proyectos', 'editar')
  const r = useMemo(
    () => resumirProyecto(seguimientos, proyecto.id, (sp) => medirSla(sp, hoy).estado),
    [seguimientos, proyecto.id, medirSla, hoy],
  )
  const etapasSla = useMemo(
    () => etapasDelProyecto(proyecto, programas, plantillas, new Set(r.plantillas)),
    [proyecto, programas, plantillas, r.plantillas],
  )
  const maxEtapa = Math.max(1, ...r.porEtapa.map((e) => e.total))
  const internos = usuarios.filter((u) => u.activo && u.rol !== 'contratista')

  return (
    <>
      <CabeceraPantalla
        titulo={proyecto.nombre}
        migas={[{ etiqueta: 'Proyectos', ruta: '/proyectos' }, { etiqueta: proyecto.nombre }]}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <Insignia tono={TONO_ESTADO[proyecto.estado]}>
              {NOMBRES_ESTADO_PROGRAMA[proyecto.estado]}
            </Insignia>
            {nombrePrograma(proyecto.programaId)}
            {proyecto.celulaId ? ` · ${nombreCelula(proyecto.celulaId)}` : ''}
          </span>
        }
        acciones={
          <div className="flex flex-wrap gap-2">
            <EnlaceBoton to={`/sitios?proy=${encodeURIComponent(proyecto.id)}`}>
              Ver sus sitios
            </EnlaceBoton>
            {puedeHacer('sitios', 'importar') && (
              <EnlaceBoton to="/tracker">
                <Upload aria-hidden className="size-4" />
                Importar tracker
              </EnlaceBoton>
            )}
          </div>
        }
      />

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {/* ------------------------------------------------ foto */}
        <Bloque
          icono={<Info aria-hidden className="size-4" />}
          titulo="Cómo va"
          className="lg:col-span-2"
        >
          {cargando ? (
            <Cargando texto="Contando sitios…" />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Metrica etiqueta="Sitios vigentes" valor={r.vigentes} />
                <Metrica etiqueta="Terminados" valor={r.cerrados} tono="ok" />
                <Metrica
                  etiqueta="Fuera de SLA"
                  valor={proyecto.sla ? r.fueraDeSla : '—'}
                  tono={r.fueraDeSla > 0 ? 'error' : 'neutro'}
                />
                <Metrica
                  etiqueta="Por vencer"
                  valor={proyecto.sla ? r.porVencer : '—'}
                  tono={r.porVencer > 0 ? 'riesgo' : 'neutro'}
                />
                <Metrica etiqueta="En hold" valor={r.bloqueados} />
                <Metrica etiqueta="No vigentes" valor={r.noVigentes} />
              </div>
              {r.porEtapa.length > 0 && (
                <ul className="flex flex-col gap-1.5" aria-label="Sitios por etapa">
                  {r.porEtapa.map((e) => (
                    <li key={e.codigo} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate text-texto-2">
                        {nombreGate(e.codigo, etapas)}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-3">
                        <span
                          className="block h-full rounded-full bg-[var(--dato)]"
                          style={{ width: `${(e.total / maxEtapa) * 100}%` }}
                        />
                      </span>
                      <span className="w-10 text-right tabular-nums">{e.total}</span>
                    </li>
                  ))}
                </ul>
              )}
              {truncado && (
                <p className="text-xs text-texto-3">
                  El despliegue tiene más sitios de los que se cargan de una vez: los números pueden
                  quedarse cortos.
                </p>
              )}
            </div>
          )}
        </Bloque>

        {/* ------------------------------------------------ datos */}
        <Bloque
          icono={<Pencil aria-hidden className="size-4" />}
          titulo="Datos del proyecto"
          accion={puedeEditar ? <Boton onClick={() => setEditandoDatos(true)}>Editar</Boton> : null}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-texto-3">Programa</dt>
            <dd>{nombrePrograma(proyecto.programaId)}</dd>
            <dt className="text-texto-3">Célula</dt>
            <dd>{proyecto.celulaId ? nombreCelula(proyecto.celulaId) : '—'}</dd>
            <dt className="text-texto-3">Proveedor</dt>
            <dd>{proyecto.proveedorId ? nombreProveedor(proyecto.proveedorId) : '—'}</dd>
            <dt className="text-texto-3">Fechas</dt>
            <dd>
              {proyecto.fechaInicio ? formatearFecha(proyecto.fechaInicio) : 'sin inicio'} →{' '}
              {proyecto.fechaFin ? formatearFecha(proyecto.fechaFin) : 'sin término'}
            </dd>
            <dt className="self-center text-texto-3">Responsable</dt>
            <dd>
              {puedeEditar ? (
                <div className="w-64 max-w-full">
                  <Selector
                    aria-label="Responsable del proyecto"
                    value={proyecto.responsableUid ?? ''}
                    onChange={(e) =>
                      guardarResponsableProyecto(proyecto, e.target.value || null, actor)
                        .then(() => avisar.ok('Responsable actualizado'))
                        .catch((err) => avisar.error(mensajeDeError(err)))
                    }
                  >
                    <option value="">Sin responsable</option>
                    {internos.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </Selector>
                </div>
              ) : (
                nombreUsuario(proyecto.responsableUid)
              )}
            </dd>
            {proyecto.descripcion && (
              <>
                <dt className="text-texto-3">Descripción</dt>
                <dd className="text-texto-2">{proyecto.descripcion}</dd>
              </>
            )}
          </dl>
        </Bloque>

        {/* ------------------------------------------------ SLA */}
        <Bloque
          icono={<Timer aria-hidden className="size-4" />}
          titulo="SLA"
          descripcion="Días que puede estar un sitio en cada etapa, contados desde que cerró la anterior."
          accion={
            puedeEditar ? (
              <Boton onClick={() => setEditandoSla(true)}>
                {proyecto.sla ? 'Editar' : 'Definir SLA'}
              </Boton>
            ) : null
          }
        >
          {proyecto.sla === null ? (
            <p className="text-sm text-texto-3">
              Este proyecto no mide SLA: no hay semáforo de plazos para sus sitios.
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-texto-3">
                    <th className="pb-1 font-normal">Etapa</th>
                    <th className="pb-1 text-right font-normal">Días</th>
                    {Object.keys(proyecto.sla.porCelula).map((c) => (
                      <th key={c} className="pb-1 text-right font-normal">
                        {nombreCelula(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapasSla.map((e) => (
                    <tr key={e.codigo} className="border-t border-borde">
                      <td className="py-1">{e.nombre}</td>
                      <td className="py-1 text-right tabular-nums">
                        {proyecto.sla?.dias[e.codigo] ?? '—'}
                      </td>
                      {Object.entries(proyecto.sla?.porCelula ?? {}).map(([c, dias]) => (
                        <td key={c} className="py-1 text-right tabular-nums text-texto-2">
                          {dias[e.codigo] ?? '·'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-texto-3">
                {proyecto.sla.habiles ? 'Días hábiles.' : 'Días corridos.'}
                {Object.keys(proyecto.sla.porCelula).length > 0 &&
                  ' «·» en una célula: usa el plazo general.'}
              </p>
            </div>
          )}
        </Bloque>

        {/* ------------------------------------------------ revisores */}
        <Bloque
          icono={<ClipboardCheck aria-hidden className="size-4" />}
          titulo="Quién revisa"
          descripcion="Las personas que responden por cada área en este proyecto. Ven sus revisiones en Pendientes."
          className="lg:col-span-2"
        >
          <RevisoresProyecto
            proyecto={proyecto}
            areas={areas.filter((a) => a.activa)}
            usuarios={internos}
            nombreUsuario={nombreUsuario}
            puedeEditar={puedeHacer('areas', 'editar')}
          />
        </Bloque>

        {/* ------------------------------------------------ tracker */}
        <Bloque
          icono={<FileSpreadsheet aria-hidden className="size-4" />}
          titulo="Tracker"
          descripcion="Qué filas del Excel son de este proyecto y con qué plantilla se leyeron."
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-texto-3">Filtro</dt>
            <dd>
              {proyecto.filtroTracker && proyecto.filtroTracker.planes.length > 0
                ? `${proyecto.filtroTracker.planes.join(', ')}${
                    proyecto.filtroTracker.soloVigentes ? ' · solo vigentes' : ''
                  }`
                : 'Entra todo el archivo'}
            </dd>
            <dt className="text-texto-3">Plantilla</dt>
            <dd>
              {r.plantillas.length === 0
                ? 'Todavía no se importa ningún sitio'
                : r.plantillas.map((id) => plantillaPorId(id)?.nombre ?? id).join(', ')}
            </dd>
          </dl>
        </Bloque>

        {/* ------------------------------------------------ acceso */}
        <Bloque
          icono={<KeyRound aria-hidden className="size-4" />}
          titulo="Quién lo ve"
          descripcion="Personas acotadas a este proyecto, a su programa o a su célula."
          accion={
            puedeHacer('usuarios', 'editar') ? (
              <EnlaceBoton to="/usuarios">Usuarios</EnlaceBoton>
            ) : null
          }
        >
          <Acceso proyecto={proyecto} />
        </Bloque>
      </div>

      {editandoDatos && (
        <DialogoCatalogo
          edicion={{ tipo: 'proyecto', existente: proyecto }}
          onCerrar={() => setEditandoDatos(false)}
          catalogos={catalogos}
          actor={actor}
        />
      )}
      {editandoSla && (
        <EditorSla
          proyecto={proyecto}
          programas={programas}
          plantillas={plantillas}
          celulas={celulas}
          actor={actor}
          onCerrar={() => setEditandoSla(false)}
        />
      )}
    </>
  )
}

/**
 * Una fila por area. Si el proyecto no tiene personas propias para un area,
 * responden las de por defecto del area; al elegir aca se crea la excepcion
 * del proyecto, y "Usar las de por defecto" la quita.
 */
function RevisoresProyecto({
  proyecto,
  areas,
  usuarios,
  nombreUsuario,
  puedeEditar,
}: {
  proyecto: Proyecto
  areas: readonly Area[]
  usuarios: Parameters<typeof SelectorPersonas>[0]['usuarios']
  nombreUsuario: (uid: string | null) => string
  puedeEditar: boolean
}) {
  const actor = useActor()
  const [guardando, setGuardando] = useState<string | null>(null)

  if (areas.length === 0) {
    return (
      <p className="text-sm text-texto-3">
        No hay áreas creadas. Créalas en Configuración → Áreas que revisan.
      </p>
    )
  }

  const guardar = (area: Area, uids: string[]) => {
    const porProyecto = { ...area.porProyecto }
    if (uids.length > 0) porProyecto[proyecto.id] = uids
    else delete porProyecto[proyecto.id]
    setGuardando(area.id)
    guardarArea(
      area.id,
      {
        nombre: area.nombre,
        alias: area.alias,
        responsables: area.responsables,
        porProyecto,
        activa: area.activa,
      },
      actor,
      area,
    )
      .catch((e) => avisar.error(`No se pudo guardar ${area.nombre}: ${mensajeDeError(e)}`))
      .finally(() => setGuardando(null))
  }

  return (
    <ul className="divide-y divide-borde">
      {areas.map((area) => {
        const propios = area.porProyecto[proyecto.id] ?? []
        const conPropios = propios.length > 0
        return (
          <li key={area.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
            <span className="w-32 shrink-0 text-sm font-medium">{area.nombre}</span>
            <div className="min-w-0 flex-1">
              {puedeEditar ? (
                <SelectorPersonas
                  elegidas={propios}
                  onCambiar={(uids) => guardar(area, uids)}
                  usuarios={usuarios}
                  etiqueta={`Agregar revisor de ${area.nombre}`}
                />
              ) : (
                <span className="text-sm">
                  {(conPropios ? propios : area.responsables).map(nombreUsuario).join(', ') ||
                    'Nadie'}
                </span>
              )}
              {!conPropios && (
                <p className="mt-1 text-xs text-texto-3">
                  {area.responsables.length > 0
                    ? `Responden los de por defecto: ${area.responsables.map(nombreUsuario).join(', ')}`
                    : 'Nadie responde por esta área todavía.'}
                </p>
              )}
            </div>
            {guardando === area.id && <span className="text-xs text-texto-3">Guardando…</span>}
            {puedeEditar && conPropios && guardando !== area.id && (
              <Boton variante="fantasma" onClick={() => guardar(area, [])}>
                Usar las de por defecto
              </Boton>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Quienes estan acotados a este proyecto, y cuantos ven todo. */
function Acceso({ proyecto }: { proyecto: Proyecto }) {
  const { usuarios } = useCatalogos()
  const activos = usuarios.filter((u) => u.activo)
  const acotados = activos.filter(
    (u) =>
      tieneAlcance(u) &&
      estaEnAlcance(u, {
        celulaId: proyecto.celulaId,
        programaId: proyecto.programaId,
        proyectoId: proyecto.id,
      }),
  )
  const todo = activos.filter((u) => !tieneAlcance(u)).length

  return (
    <div className="flex flex-col gap-2 text-sm">
      {acotados.length === 0 ? (
        <p className="text-texto-3">Nadie está acotado solo a este proyecto.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {acotados.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2">
              <span>{u.nombre}</span>
              <span className="text-xs text-texto-3">{NOMBRES_ROL[u.rol]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-texto-3">
        Además, {todo} persona(s) sin alcance acotado ven todos los proyectos.
      </p>
    </div>
  )
}
