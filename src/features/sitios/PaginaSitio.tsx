import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { FolderOpen, MapPin, Pencil, Save, Trash2 } from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  Campo,
  Cargando,
  Casilla,
  Dialogo,
  EnlaceBoton,
  Entrada,
  EstadoVacio,
  Insignia,
  InsigniaGate,
  Metrica,
  cn,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { contarReferencias } from '@/data/repos/catalogos'
import {
  actualizarCarpeta,
  actualizarSitio,
  eliminarSitio,
  observarSitio,
} from '@/data/repos/sitios'
import { observarSeguimientosDeSitio } from '@/data/repos/sitioProyectos'
import { formatearFecha, formatearFechaHora, hoyEnChile } from '@/domain/fechas'
import { textoAtraso } from '@/domain/gates/atraso'
import { nombreGate } from '@/domain/gates/catalogo'
import { atrasoDeSeguimiento } from '@/domain/vistas/filtrado'
import { textoSla } from '@/domain/sla'
import { useMedidorSla } from '@/hooks/useSla'
import { esquemaSitioNuevo, estaEnChile, type Sitio, type SitioNuevo } from '@/domain/tipos/sitio'
import type { Actor } from '@/domain/tipos/comunes'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { DialogoEliminar } from '@/features/admin/DialogoEliminar'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useSuscripcion } from '@/hooks/useSuscripcion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

const SIN_SEGUIMIENTOS: SitioProyecto[] = []

/** Los campos editables de un sitio, sin los sellos de sistema. */
function datosDe(sitio: Sitio): SitioNuevo {
  const { creadoEn: _c, creadoPor: _cp, actualizadoEn: _a, actualizadoPor: _ap, ...datos } = sitio
  return datos
}

/** Edita el maestro sin esperar al servidor (sin señal no llega nunca). */
function guardarEdicion(sitio: Sitio, datos: SitioNuevo, actor: Actor, aviso: string) {
  actualizarSitio(sitio, datos, actor).catch((e) =>
    avisar.error(`No se pudieron guardar los cambios del sitio ${sitio.id}: ${mensajeDeError(e)}`),
  )
  avisar.ok(aviso)
}

export function PaginaSitio() {
  const { sitioId } = useParams<{ sitioId: string }>()
  const navegar = useNavigate()
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const { nombrePrograma, nombreProyecto, nombreProveedor, etapas } = useCatalogos()
  const medirSla = useMedidorSla()
  const [carpeta, setCarpeta] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const suscribirSitio = useCallback(
    (cb: (s: Sitio | null) => void, onError: (e: Error) => void) => {
      if (!sitioId) return () => {}
      return observarSitio(sitioId, cb, onError)
    },
    [sitioId],
  )

  const suscribirSeguimientos = useCallback(
    (cb: (s: SitioProyecto[]) => void, onError: (e: Error) => void) => {
      if (!sitioId) return () => {}
      return observarSeguimientosDeSitio(actor, sitioId, cb, onError)
    },
    [actor, sitioId],
  )

  const {
    datos: sitio,
    cargando,
    error,
  } = useSuscripcion<Sitio | null>(sitioId ? suscribirSitio : null, null)
  const participaciones = useSuscripcion(sitioId ? suscribirSeguimientos : null, SIN_SEGUIMIENTOS)

  const hoy = hoyEnChile()
  useTituloPagina(sitio ? `${sitio.id} · ${sitio.nombre}` : 'Sitio')
  const valorCarpeta = carpeta ?? sitio?.carpetaUrl ?? ''
  const carpetaCambiada = sitio ? valorCarpeta !== (sitio.carpetaUrl ?? '') : false

  const enlaceMapa = useMemo(
    () =>
      sitio
        ? `https://www.openstreetmap.org/?mlat=${sitio.lat}&mlon=${sitio.lon}#map=16/${sitio.lat}/${sitio.lon}`
        : '',
    [sitio],
  )

  if (cargando && !sitio) return <Cargando texto="Cargando el sitio…" />

  if (error) {
    return (
      <div className="p-4">
        <Aviso tono="error" titulo="No pudimos cargar el sitio">
          {error}
        </Aviso>
      </div>
    )
  }

  if (!sitio) {
    return (
      <EstadoVacio
        titulo="Ese sitio no existe en el maestro"
        descripcion={`No encontramos el ID "${sitioId}". Revisa el enlace o importalo primero.`}
        accion={<EnlaceBoton to="/sitios">Volver al maestro</EnlaceBoton>}
      />
    )
  }

  return (
    <>
      <CabeceraPantalla
        migas={[{ etiqueta: 'Sitios', ruta: '/sitios' }, { etiqueta: sitio.id }]}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-texto-2">{sitio.id}</span>
            {sitio.nombre}
            {!sitio.activo && <Insignia tono="riesgo">Inactivo</Insignia>}
          </span>
        }
        descripcion={
          <span className="flex flex-wrap items-center gap-x-3">
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="size-3" />
              {sitio.comuna}, {sitio.region}
            </span>
            {sitio.direccion && <span>{sitio.direccion}</span>}
            {sitio.tipoSitio && <span>{sitio.tipoSitio}</span>}
          </span>
        }
        acciones={
          <span className="flex flex-wrap items-center gap-2">
            {puedeHacer('sitios', 'editar') && (
              <Boton
                tamano="sm"
                onClick={() => setEditando(true)}
                icono={<Pencil aria-hidden className="size-3.5" />}
              >
                Editar sitio
              </Boton>
            )}
            {puedeHacer('sitios', 'eliminar') && (
              <Boton
                tamano="sm"
                variante="peligro"
                onClick={() => setEliminando(true)}
                icono={<Trash2 aria-hidden className="size-3.5" />}
              >
                Eliminar
              </Boton>
            )}
            <EnlaceBoton to="/mapa" tamano="sm">
              Ver en el mapa
            </EnlaceBoton>
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Metrica etiqueta="Latitud" valor={sitio.lat.toFixed(5)} />
          <Metrica etiqueta="Longitud" valor={sitio.lon.toFixed(5)} />
          <Metrica etiqueta="Programas" valor={participaciones.datos.length} />
          <div className="flex flex-col">
            <span className="text-[11px] text-texto-3">Tecnologias</span>
            <span className="flex flex-wrap gap-1">
              {sitio.tecnologias.length === 0 ? (
                <span className="text-sm text-texto-3">—</span>
              ) : (
                sitio.tecnologias.map((t) => (
                  <Insignia key={t} tono="neutro">
                    {t}
                  </Insignia>
                ))
              )}
            </span>
          </div>
        </div>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <section
            aria-label="Participacion en programas"
            className="rounded border border-borde bg-superficie"
          >
            <h2 className="border-b border-borde px-3 py-2 text-xs font-semibold text-texto-2">
              Participacion en programas
            </h2>

            {participaciones.datos.length === 0 ? (
              <EstadoVacio
                titulo="Este sitio no esta en ningun programa"
                descripcion="Un sitio del maestro puede existir sin seguimiento hasta que se incorpore a un proyecto."
              />
            ) : (
              <ul className="divide-y divide-borde">
                {participaciones.datos.map((sp) => {
                  const dias = atrasoDeSeguimiento(sp, hoy)
                  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
                  const sla = medirSla(sp, hoy)
                  return (
                    <li
                      key={sp.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                    >
                      <div className="min-w-44 flex-1">
                        <p className="text-sm font-medium">{nombrePrograma(sp.programaId)}</p>
                        <p className="text-xs text-texto-2">{nombreProyecto(sp.proyectoId)}</p>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-texto-2">
                        <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
                        {nombreGate(sp.gateActual, etapas)}
                      </span>
                      {/* Solo lo que tiene dato: una fila de guiones no dice nada. */}
                      {gate?.fechaPlan && (
                        <div className="text-xs text-texto-2">
                          <p>Plan {formatearFecha(gate.fechaPlan)}</p>
                          <p className={dias !== null && dias > 0 ? 'text-[var(--error-fg)]' : ''}>
                            {textoAtraso(dias)}
                          </p>
                        </div>
                      )}
                      {sla.estado !== 'sin_sla' && sla.estado !== 'cerrado' && (
                        <span
                          className={cn(
                            'text-xs',
                            sla.estado === 'vencido'
                              ? 'font-semibold text-[var(--error-fg)]'
                              : sla.estado === 'por_vencer'
                                ? 'text-[var(--riesgo-fg)]'
                                : 'text-texto-2',
                          )}
                        >
                          SLA {textoSla(sla)}
                        </span>
                      )}
                      {sp.proveedorId && (
                        <span className="text-xs text-texto-2">
                          {nombreProveedor(sp.proveedorId)}
                        </span>
                      )}
                      <EnlaceBoton to={`/seguimiento/${encodeURIComponent(sp.id)}`} tamano="sm">
                        Abrir ficha
                      </EnlaceBoton>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-3">
            <section
              aria-label="Carpeta documental"
              className="rounded border border-borde bg-superficie p-3"
            >
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-texto-2">
                <FolderOpen aria-hidden className="size-3.5" />
                Carpeta documental
              </h2>

              <Campo
                etiqueta="URL de la carpeta en SharePoint"
                htmlFor="carpeta"
                ayuda="Se pega a mano. En Fase 2 la app genera el correo que dispara el flujo de Power Automate que crea la estructura."
              >
                <Entrada
                  id="carpeta"
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  value={valorCarpeta}
                  disabled={!puedeHacer('sitios', 'editar')}
                  onChange={(e) => setCarpeta(e.target.value)}
                />
              </Campo>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Boton
                  variante="primario"
                  tamano="sm"
                  disabled={!carpetaCambiada || !puedeHacer('sitios', 'editar')}
                  icono={<Save aria-hidden className="size-3.5" />}
                  onClick={() => {
                    actualizarCarpeta(sitio, valorCarpeta.trim() || null, actor).catch((e) =>
                      avisar.error(mensajeDeError(e)),
                    )
                    avisar.ok('Carpeta actualizada')
                    setCarpeta(null)
                  }}
                >
                  Guardar
                </Boton>
                {sitio.carpetaUrl && (
                  <a
                    href={sitio.carpetaUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded text-xs text-[var(--acento)] hover:underline"
                  >
                    Abrir carpeta
                  </a>
                )}
              </div>
            </section>

            <section
              aria-label="Datos del registro"
              className="rounded border border-borde bg-superficie p-3"
            >
              <h2 className="mb-2 text-xs font-semibold text-texto-2">Registro</h2>
              <dl className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-texto-3">Creado</dt>
                  <dd>{formatearFechaHora(sitio.creadoEn)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-texto-3">Ultima modificacion</dt>
                  <dd>{formatearFechaHora(sitio.actualizadoEn)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-texto-3">Coordenadas</dt>
                  <dd>
                    <a
                      href={enlaceMapa}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded text-[var(--acento)] hover:underline"
                    >
                      {sitio.lat.toFixed(5)}, {sitio.lon.toFixed(5)}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      {editando && (
        <DialogoEditarSitio
          sitio={sitio}
          seguimientos={participaciones.datos.length}
          onCerrar={() => setEditando(false)}
          onGuardar={(datos) => {
            guardarEdicion(sitio, datos, actor, `Cambios guardados en el sitio ${sitio.id}`)
            setEditando(false)
          }}
        />
      )}

      {eliminando && (
        <DialogoEliminar
          titulo="Eliminar sitio"
          etiquetaEliminar="Eliminar sitio"
          nombre={`${sitio.id} · ${sitio.nombre}`}
          queEs="el sitio"
          verificar={() => contarReferencias('sitio', sitio.id)}
          eliminar={() => eliminarSitio(sitio, actor)}
          alternativa={
            sitio.activo
              ? {
                  etiqueta: 'Desactivar sitio',
                  explicacion:
                    'Desactivarlo no borra nada: sus seguimientos y su historial quedan intactos, y se puede volver a activar editándolo.',
                  ejecutar: () =>
                    guardarEdicion(
                      sitio,
                      { ...datosDe(sitio), activo: false },
                      actor,
                      `El sitio ${sitio.id} quedó inactivo`,
                    ),
                }
              : null
          }
          onCerrar={() => setEliminando(false)}
          onEliminado={() => navegar('/sitios')}
        />
      )}
    </>
  )
}

/** Texto a numero aceptando coma decimal ("-33,45"). NaN si esta vacio. */
function aNumero(texto: string): number {
  const limpio = texto.trim().replace(',', '.')
  return limpio === '' ? Number.NaN : Number(limpio)
}

function DialogoEditarSitio({
  sitio,
  seguimientos,
  onCerrar,
  onGuardar,
}: {
  sitio: Sitio
  seguimientos: number
  onCerrar: () => void
  onGuardar: (datos: SitioNuevo) => void
}) {
  const [nombre, setNombre] = useState(sitio.nombre)
  const [region, setRegion] = useState(sitio.region)
  const [comuna, setComuna] = useState(sitio.comuna)
  const [direccion, setDireccion] = useState(sitio.direccion)
  const [lat, setLat] = useState(String(sitio.lat))
  const [lon, setLon] = useState(String(sitio.lon))
  const [tecnologias, setTecnologias] = useState(sitio.tecnologias.join(', '))
  const [tipoSitio, setTipoSitio] = useState(sitio.tipoSitio)
  const [activo, setActivo] = useState(sitio.activo)
  const [error, setError] = useState<string | null>(null)

  const guardar = () => {
    const latNum = aNumero(lat)
    const lonNum = aNumero(lon)
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      setError('La latitud y la longitud tienen que ser números, por ejemplo -33.4489 y -70.6693.')
      return
    }
    if (!estaEnChile(latNum, lonNum)) {
      setError(
        'Esas coordenadas quedan fuera de Chile. Revisa que no estén invertidas y que ambas sean negativas.',
      )
      return
    }

    const candidato: SitioNuevo = {
      ...datosDe(sitio),
      nombre: nombre.trim(),
      region: region.trim(),
      comuna: comuna.trim(),
      direccion: direccion.trim(),
      lat: latNum,
      lon: lonNum,
      tecnologias: [
        ...new Set(
          tecnologias
            .split(/[,;/]/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      tipoSitio: tipoSitio.trim(),
      activo,
    }

    // El mismo esquema Zod que valida la importación.
    const validado = esquemaSitioNuevo.safeParse(candidato)
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Los datos del sitio no son válidos.')
      return
    }
    onGuardar(validado.data)
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Editar sitio"
      descripcion={`ID ${sitio.id}. El ID no se puede cambiar.`}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar}>
            Guardar cambios
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Aviso tono="error">{error}</Aviso>}

        {seguimientos > 0 && (
          <p className="text-xs text-texto-2">
            Nombre, región, comuna y coordenadas también se actualizan en{' '}
            {seguimientos === 1
              ? 'el seguimiento de este sitio'
              : `los ${seguimientos} seguimientos de este sitio`}
            .
          </p>
        )}

        <Campo etiqueta="Nombre" htmlFor="sitio-nombre" obligatorio>
          <Entrada
            id="sitio-nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Región" htmlFor="sitio-region" obligatorio>
            <Entrada id="sitio-region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </Campo>
          <Campo etiqueta="Comuna" htmlFor="sitio-comuna" obligatorio>
            <Entrada id="sitio-comuna" value={comuna} onChange={(e) => setComuna(e.target.value)} />
          </Campo>
        </div>

        <Campo etiqueta="Dirección" htmlFor="sitio-direccion">
          <Entrada
            id="sitio-direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Latitud" htmlFor="sitio-lat" obligatorio>
            <Entrada
              id="sitio-lat"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Longitud" htmlFor="sitio-lon" obligatorio>
            <Entrada
              id="sitio-lon"
              inputMode="decimal"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Tecnologías"
            htmlFor="sitio-tecnologias"
            ayuda="Separadas por coma. Ej.: 4G, 5G"
          >
            <Entrada
              id="sitio-tecnologias"
              value={tecnologias}
              onChange={(e) => setTecnologias(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Tipo de sitio" htmlFor="sitio-tipo">
            <Entrada
              id="sitio-tipo"
              value={tipoSitio}
              onChange={(e) => setTipoSitio(e.target.value)}
            />
          </Campo>
        </div>

        <Casilla
          etiqueta="Sitio activo"
          descripcion="Desactivarlo no borra nada: sus seguimientos y su historial quedan intactos."
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
        />
      </div>
    </Dialogo>
  )
}
