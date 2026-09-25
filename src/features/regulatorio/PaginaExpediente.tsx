import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { ExternalLink, FolderOpen, Scale } from 'lucide-react'
import {
  AreaTexto,
  Aviso,
  BarraProgreso,
  Boton,
  CabeceraPantalla,
  Cargando,
  EnlaceBoton,
  Entrada,
  EstadoVacio,
  Insignia,
  Seccion,
  Selector,
  cn,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { observarSeguimiento } from '@/data/repos/sitioProyectos'
import {
  cambiarModalidad,
  guardarItemRegulatorio,
  observarRegistroRegulatorio,
  type CambioItem,
} from '@/data/repos/regulatorio'
import { diasEntre, formatearFecha, hoyEnChile } from '@/domain/fechas'
import {
  avanceDe,
  carpetasPara,
  ESTADOS_DOCUMENTO,
  estadoItem,
  fechaAlAire,
  modalidadDe,
  modalidadSugerida,
  NOMBRES_ESTADO_DOCUMENTO,
  NOMBRES_MODALIDAD,
  NOTA_COHERENCIA,
  type DocumentoRegulatorio,
  type EstadoDocumento,
  type EstadoItemRegulatorio,
  type Modalidad,
  type RegistroRegulatorio,
} from '@/domain/regulatorio'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useSesion } from '@/hooks/useSesion'
import { useSuscripcion } from '@/hooks/useSuscripcion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

const TONO_ESTADO: Record<EstadoDocumento, string> = {
  pendiente: 'border-borde text-texto-2',
  en_tramite: 'border-[var(--info-fg)] text-[var(--info-fg)] bg-[var(--info-bg)]',
  observado: 'border-[var(--error-fg)] text-[var(--error-fg)] bg-[var(--error-bg)]',
  listo: 'border-[var(--ok-fg)] text-[var(--ok-fg)] bg-[var(--ok-bg)]',
  no_aplica: 'border-borde text-texto-3 bg-superficie-2',
}

/** Expediente regulatorio de un seguimiento al aire: sus carpetas y documentos. */
export function PaginaExpediente() {
  const { seguimientoId = '' } = useParams()
  const { actor, puedeHacer } = useSesion()
  const { nombreProyecto } = useCatalogos()

  const suscribirSp = useCallback(
    (cb: (d: SitioProyecto | null) => void, onError: (e: Error) => void) =>
      observarSeguimiento(seguimientoId, cb, onError),
    [seguimientoId],
  )
  const suscribirRegistro = useCallback(
    (cb: (d: RegistroRegulatorio | null) => void, onError: (e: Error) => void) =>
      observarRegistroRegulatorio(seguimientoId, cb, onError),
    [seguimientoId],
  )
  const sp = useSuscripcion(suscribirSp, null)
  const registro = useSuscripcion(suscribirRegistro, null)
  useTituloPagina(sp.datos ? `Regulatorio · ${sp.datos.sitioId}` : 'Regulatorio')

  if (sp.cargando) return <Cargando texto="Abriendo el expediente…" />
  if (sp.error || !sp.datos) {
    return (
      <EstadoVacio
        icono={<Scale aria-hidden className="size-6" />}
        titulo="No se encontró el seguimiento"
        descripcion={sp.error ?? 'Revisa el enlace o vuelve a la lista de Regulatorio.'}
        accion={<EnlaceBoton to="/regulatorio">Ir a Regulatorio</EnlaceBoton>}
      />
    )
  }

  return (
    <Expediente
      sp={sp.datos}
      registro={registro.datos}
      errorRegistro={registro.error}
      nombreProyecto={nombreProyecto(sp.datos.proyectoId)}
      editable={actor !== null && puedeHacer('regulatorio', 'editar')}
    />
  )
}

function Expediente({
  sp,
  registro,
  errorRegistro,
  nombreProyecto,
  editable,
}: {
  sp: SitioProyecto
  registro: RegistroRegulatorio | null
  errorRegistro: string | null
  nombreProyecto: string
  editable: boolean
}) {
  const { actor } = useSesion()
  const hoy = hoyEnChile()
  const aire = fechaAlAire(sp)
  const modalidad = modalidadDe(sp, registro)
  const sugerida = modalidadSugerida(sp)
  const carpetas = useMemo(() => carpetasPara(modalidad), [modalidad])
  const total = avanceDe(
    carpetas.flatMap((c) => c.documentos),
    registro,
  )

  const cambiar = async (valor: string) => {
    if (!actor) return
    const nueva: Modalidad | null = valor === '' ? null : (valor as Modalidad)
    try {
      await cambiarModalidad(sp, nueva, modalidad, actor)
    } catch (e) {
      avisar.error(`No se pudo cambiar el tipo de sitio: ${mensajeDeError(e)}`)
    }
  }

  return (
    <>
      <CabeceraPantalla
        ancho="max-w-5xl"
        migas={[
          { etiqueta: 'Regulatorio', ruta: '/regulatorio' },
          {
            etiqueta: nombreProyecto,
            ruta: `/regulatorio?proyecto=${encodeURIComponent(sp.proyectoId)}`,
          },
          { etiqueta: sp.sitioId },
        ]}
        titulo={`${sp.sitioId} · ${sp.sitioNombre}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {sp.comuna}, {sp.region}
            </span>
            {aire.alAire ? (
              <Insignia tono="ok">
                Al aire{aire.fecha ? ` desde ${formatearFecha(aire.fecha)}` : ''}
                {aire.fecha ? ` · ${Math.max(0, diasEntre(aire.fecha, hoy))} días` : ''}
              </Insignia>
            ) : (
              <Insignia tono="riesgo">Todavía no sale al aire</Insignia>
            )}
          </span>
        }
        acciones={
          <>
            <EnlaceBoton to={`/seguimiento/${encodeURIComponent(sp.id)}`}>
              Ver seguimiento
            </EnlaceBoton>
          </>
        }
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-col gap-1 text-xs text-texto-3">
            Tipo de sitio
            <div className="w-72">
              <Selector
                value={registro?.modalidad ?? ''}
                disabled={!editable}
                onChange={(e) => void cambiar(e.target.value)}
              >
                <option value="">Según el tracker ({NOMBRES_MODALIDAD[sugerida]})</option>
                <option value="normal">{NOMBRES_MODALIDAD.normal}</option>
                <option value="concurso">{NOMBRES_MODALIDAD.concurso}</option>
              </Selector>
            </div>
          </label>
          <div className="min-w-48 flex-1 sm:max-w-72">
            <div className="mb-1 flex items-center justify-between text-[11px] text-texto-3">
              <span>Expediente</span>
              <span className="tabular-nums">
                {total.listos} de {total.total} listos · {total.porcentaje}%
              </span>
            </div>
            <BarraProgreso valor={total.porcentaje} />
          </div>
          {total.observados > 0 && (
            <Insignia tono="error">{total.observados} observado(s)</Insignia>
          )}
        </div>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          {errorRegistro && (
            <Aviso tono="error">No se pudo leer el expediente: {errorRegistro}</Aviso>
          )}
          {!aire.alAire && (
            <Aviso tono="info">
              Este seguimiento aún no sale al aire. Puedes adelantar documentos, pero el proceso
              regulatorio empieza con el On Air.
            </Aviso>
          )}
          <Aviso tono="info" titulo="Coherencia del expediente">
            {NOTA_COHERENCIA}
          </Aviso>

          {carpetas.map((c) => {
            const avance = avanceDe(c.documentos, registro)
            return (
              <Seccion
                key={c.id}
                id={`regulatorio.${c.id}`}
                icono={<FolderOpen aria-hidden className="size-4" />}
                titulo={`${c.numero}. ${c.nombre}`}
                descripcion={c.descripcion}
                resumen={`${avance.listos}/${avance.total} listos${avance.observados > 0 ? ` · ${avance.observados} observados` : ''}`}
              >
                <ul className="flex flex-col divide-y divide-[var(--vidrio-divisor)]">
                  {c.documentos.map((d) => (
                    <FilaDocumento
                      key={d.id}
                      sp={sp}
                      documento={d}
                      estado={estadoItem(registro, d.id)}
                      editable={editable}
                    />
                  ))}
                </ul>
              </Seccion>
            )
          })}

          <p className="pb-4 text-xs text-texto-3">
            La documentación requerida puede variar según las características de cada sitio (tipo de
            terreno, propietario, ubicación, estructura, permisos y modificaciones del proyecto). Lo
            que no corresponda se marca «No aplica». Los plazos y normas son referenciales:
            confírmalos con Legal antes de un ingreso.
          </p>
        </div>
      </div>
    </>
  )
}

function FilaDocumento({
  sp,
  documento: d,
  estado,
  editable,
}: {
  sp: SitioProyecto
  documento: DocumentoRegulatorio
  estado: EstadoItemRegulatorio
  editable: boolean
}) {
  const { actor, perfil } = useSesion()
  const { nombreUsuario } = useCatalogos()
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<CambioItem | null>(null)
  const [guardando, setGuardando] = useState(false)

  const actual: CambioItem = borrador ?? {
    estado: estado.estado,
    fecha: estado.fecha,
    referencia: estado.referencia,
    obs: estado.obs,
    url: estado.url,
  }

  const guardar = async (cambio: CambioItem): Promise<boolean> => {
    if (!actor) return false
    setGuardando(true)
    try {
      await guardarItemRegulatorio(sp, d.id, d.nombre, cambio, estado, actor)
      setBorrador(null)
      return true
    } catch (e) {
      avisar.error(`No se pudo guardar «${d.nombre}»: ${mensajeDeError(e)}`)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const campo = <K extends keyof CambioItem>(clave: K, valor: CambioItem[K]) =>
    setBorrador({ ...actual, [clave]: valor })

  const detalle = [d.organismo, d.norma, d.plazo].filter(Boolean).join(' · ')

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {d.nombre}
            {d.condicional && <Insignia title={d.condicion ?? undefined}>Si corresponde</Insignia>}
            {d.aplica === 'concurso' && <Insignia tono="acento">Concurso</Insignia>}
          </p>
          <p className="text-xs text-texto-2">{d.descripcion}</p>
          {detalle && <p className="mt-0.5 text-[11px] text-texto-3">{detalle}</p>}
          {d.condicional && d.condicion && (
            <p className="mt-0.5 text-[11px] text-texto-3">Aplica: {d.condicion}</p>
          )}
          {(estado.referencia || estado.fecha || estado.url) && !abierto && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-texto-2">
              {estado.referencia && <span>N° {estado.referencia}</span>}
              {estado.fecha && <span>{formatearFecha(estado.fecha)}</span>}
              {estado.url && (
                <a
                  href={estado.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--acento)] hover:underline"
                >
                  <ExternalLink aria-hidden className="size-3" /> Archivo
                </a>
              )}
            </p>
          )}
          {estado.obs && !abierto && (
            <p className="mt-1 line-clamp-2 text-xs text-texto-2">{estado.obs}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={`Estado de ${d.nombre}`}
            value={actual.estado}
            disabled={!editable || guardando}
            onChange={(e) => {
              const siguiente = { ...actual, estado: e.target.value as EstadoDocumento }
              // Al marcar listo sin fecha, se asume hoy: es lo que casi siempre pasa.
              if (siguiente.estado === 'listo' && !siguiente.fecha) {
                siguiente.fecha = hoyEnChile()
              }
              if (abierto) setBorrador(siguiente)
              else void guardar(siguiente)
            }}
            className={cn(
              'h-8 cursor-pointer rounded border px-2 text-xs font-medium',
              'disabled:cursor-not-allowed disabled:opacity-70',
              TONO_ESTADO[actual.estado],
            )}
          >
            {ESTADOS_DOCUMENTO.map((e) => (
              <option key={e} value={e}>
                {NOMBRES_ESTADO_DOCUMENTO[e]}
              </option>
            ))}
          </select>
          {editable && (
            <Boton
              tamano="sm"
              variante="fantasma"
              onClick={() => {
                setAbierto((v) => !v)
                setBorrador(null)
              }}
            >
              {abierto ? 'Cerrar' : 'Detalle'}
            </Boton>
          )}
        </div>
      </div>

      {abierto && (
        <div className="mt-2 grid gap-2 rounded-lg bg-superficie-2 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-texto-3">
            N° de documento / ingreso
            <Entrada
              value={actual.referencia}
              onChange={(e) => campo('referencia', e.target.value)}
              placeholder="Ej. D.E. 123, Ingreso 45678"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-texto-3">
            Fecha
            <Entrada
              type="date"
              value={actual.fecha ?? ''}
              onChange={(e) => campo('fecha', e.target.value === '' ? null : e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-texto-3">
            Enlace al archivo
            <Entrada
              type="url"
              value={actual.url}
              onChange={(e) => campo('url', e.target.value)}
              placeholder="https://…sharepoint.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-texto-3 sm:col-span-3">
            Observaciones
            <AreaTexto rows={2} value={actual.obs} onChange={(e) => campo('obs', e.target.value)} />
          </label>
          <div className="flex items-center justify-between gap-2 sm:col-span-3">
            <span className="text-[11px] text-texto-3">
              {estado.por
                ? `Último cambio: ${estado.por === perfil?.id ? 'tú' : nombreUsuario(estado.por)}${
                    estado.en ? `, ${estado.en.toLocaleDateString('es-CL')}` : ''
                  }`
                : 'Sin cambios todavía'}
            </span>
            <Boton
              tamano="sm"
              variante="primario"
              disabled={borrador === null || guardando}
              onClick={() => {
                if (borrador) void guardar(borrador).then((ok) => ok && setAbierto(false))
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      )}
    </li>
  )
}
