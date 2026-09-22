import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { FolderOpen, MapPin, Save } from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  Campo,
  Cargando,
  EnlaceBoton,
  Entrada,
  EstadoVacio,
  Insignia,
  InsigniaGate,
  Metrica,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { actualizarCarpeta, observarSitio } from '@/data/repos/sitios'
import { observarSeguimientosDeSitio } from '@/data/repos/sitioProyectos'
import { formatearFecha, formatearFechaHora, hoyEnChile } from '@/domain/fechas'
import { textoAtraso } from '@/domain/gates/atraso'
import { nombreGate } from '@/domain/gates/catalogo'
import { atrasoDeSeguimiento } from '@/domain/vistas/filtrado'
import type { Sitio } from '@/domain/tipos/sitio'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useSuscripcion } from '@/hooks/useSuscripcion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

const SIN_SEGUIMIENTOS: SitioProyecto[] = []

export function PaginaSitio() {
  const { sitioId } = useParams<{ sitioId: string }>()
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const { nombrePrograma, nombreProyecto, nombreProveedor } = useCatalogos()
  const [carpeta, setCarpeta] = useState<string | null>(null)

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
      return observarSeguimientosDeSitio(sitioId, cb, onError)
    },
    [sitioId],
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
          <EnlaceBoton to="/mapa" tamano="sm">
            Ver en el mapa
          </EnlaceBoton>
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
                  return (
                    <li
                      key={sp.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                    >
                      <div className="min-w-44 flex-1">
                        <p className="text-sm font-medium">{nombrePrograma(sp.programaId)}</p>
                        <p className="text-xs text-texto-2">{nombreProyecto(sp.proyectoId)}</p>
                      </div>
                      <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
                      <div className="text-xs text-texto-2">
                        <p>Plan {formatearFecha(gate?.fechaPlan ?? null)}</p>
                        <p className={dias !== null && dias > 0 ? 'text-[var(--error-fg)]' : ''}>
                          {textoAtraso(dias)}
                        </p>
                      </div>
                      <div className="text-xs text-texto-2">
                        <p>{nombreProveedor(sp.proveedorId)}</p>
                        <p>{nombreGate(sp.gateActual)}</p>
                      </div>
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
    </>
  )
}
