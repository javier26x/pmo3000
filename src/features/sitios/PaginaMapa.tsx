import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MapPin, X } from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  EnlaceBoton,
  Insignia,
  InsigniaGate,
  Selector,
  cn,
} from '@/components/ui'
import { formatearFecha } from '@/domain/fechas'
import { NOMBRES_SEMAFORO, textoAtraso } from '@/domain/gates/atraso'
import { semaforoDeSeguimiento } from '@/domain/vistas/filtrado'
import { CERRADO, claseGate, nombreGate, type EtapaCatalogo } from '@/domain/gates/catalogo'
import { atrasoDeSeguimiento } from '@/domain/vistas/filtrado'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { usarTema } from '@/app/tema'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { useDespliegue } from '@/hooks/useDespliegue'
import { BarraFiltros } from './BarraFiltros'
import { leerPaleta, type ModoColor } from './coloresMapa'

/** Centro y zoom iniciales: Chile continental completo. */
const CENTRO: [number, number] = [-35.5, -71.3]
const ZOOM = 5

/**
 * Aviso cuando las imágenes del mapa no cargan (sin señal, o red corporativa que
 * bloquea el proveedor de teselas). Sin esto el mapa queda en blanco y parece
 * roto, cuando en realidad los sitios están bien ubicados.
 */
function DetectorDeTeselas({ onFallar }: { onFallar: () => void }) {
  const mapa = useMap()

  useEffect(() => {
    let fallidas = 0
    const alFallar = () => {
      fallidas += 1
      // Una tesela suelta falla siempre; varias seguidas es que no hay acceso.
      if (fallidas === 6) onFallar()
    }
    mapa.eachLayer((capa) => capa.on('tileerror', alFallar))
    return () => {
      mapa.eachLayer((capa) => capa.off('tileerror', alFallar))
    }
  }, [mapa, onFallar])

  return null
}

/** Zoom al abrir el mapa desde un sitio: se ve la manzana y el sitio sale del cluster. */
const ZOOM_SITIO = 17

/**
 * Lleva el mapa al sitio que pide la URL (`/mapa?sitio=…&lat=…&lon=…`, el enlace
 * "Ver en el mapa" de la ficha) y lo marca con un anillo. Las coordenadas viajan
 * en el enlace para que funcione aunque el sitio quede fuera de los filtros (no
 * vigente, de otro proyecto): el punto se muestra igual.
 */
function EnfoqueSitio({ lat, lon }: { lat: number; lon: number }) {
  const mapa = useMap()

  useEffect(() => {
    mapa.flyTo([lat, lon], ZOOM_SITIO, { duration: 0.8 })
    // Leaflet escribe el color como atributo SVG, donde var() no se resuelve.
    const acento =
      getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#da291c'
    const anillo = L.circleMarker([lat, lon], {
      radius: 16,
      weight: 3,
      color: acento,
      fill: false,
      interactive: false,
    }).addTo(mapa)
    return () => {
      anillo.remove()
    }
  }, [mapa, lat, lon])

  return null
}

/**
 * Un solo lienzo para todos los puntos. Con SVG cada sitio es un nodo del DOM y
 * mover el mapa con 4.500 de ellos se traba; en canvas es un solo elemento.
 */
const LIENZO = L.canvas({ padding: 0.5 })

function CapaSeguimientos({
  datos,
  modo,
  hoy,
  etapas,
  onElegir,
}: {
  datos: SitioProyecto[]
  modo: ModoColor
  hoy: string
  etapas: readonly EtapaCatalogo[]
  onElegir: (sp: SitioProyecto) => void
}) {
  const mapa = useMap()
  const tema = usarTema((e) => e.tema)
  const grupoRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    // Clustering obligatorio: 4.500 marcadores sueltos dejan el mapa inservible.
    const grupo = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 120,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      removeOutsideVisibleBounds: true,
    })
    grupoRef.current = grupo
    mapa.addLayer(grupo)
    return () => {
      mapa.removeLayer(grupo)
      grupoRef.current = null
    }
  }, [mapa])

  useEffect(() => {
    const grupo = grupoRef.current
    if (!grupo) return

    // Las etapas vienen de la plantilla de cada programa: sin ellas, todo codigo
    // que no fuera CERRADO caia en el gris por defecto y el mapa entero salia
    // de un solo color.
    const paleta = leerPaleta(etapas)
    grupo.clearLayers()

    const marcadores = datos
      .filter((sp) => Number.isFinite(sp.lat) && Number.isFinite(sp.lon))
      .map((sp) => {
        const estado = semaforoDeSeguimiento(sp, hoy)
        const color =
          modo === 'gate'
            ? (paleta.gate[sp.gateActual] ?? paleta.gate[CERRADO] ?? '#888')
            : (paleta.semaforo[estado] ?? '#888')

        const marcador = L.circleMarker([sp.lat, sp.lon], {
          renderer: LIENZO,
          radius: 6,
          weight: 1.5,
          color: '#ffffff',
          fillColor: color,
          fillOpacity: 0.95,
        })

        // El tooltip se arma recien al pasar el cursor: crearlo por adelantado
        // eran miles de objetos que casi nadie llega a ver.
        marcador.once('mouseover', () => {
          marcador
            .bindTooltip(`${sp.sitioId} — ${sp.sitioNombre}`, { direction: 'top' })
            .openTooltip()
        })
        // El detalle se muestra en un panel de React (no en un popup de Leaflet)
        // para poder navegar con el router y que funcione bien en celular.
        marcador.on('click', () => onElegir(sp))
        return marcador
      })

    grupo.addLayers(marcadores)
  }, [datos, modo, hoy, tema, etapas, onElegir])

  return null
}

export default function PaginaMapa() {
  const { visibles, cargando, error, hoy } = useDespliegue()
  const { nombrePrograma, nombreProveedor, etapas } = useCatalogos()
  const [modo, setModo] = useState<ModoColor>('gate')
  useTituloPagina('Mapa')
  const [elegidoManual, setElegido] = useState<SitioProyecto | null>(null)
  const [sinTeselas, setSinTeselas] = useState(false)
  const marcarSinTeselas = useCallback(() => setSinTeselas(true), [])

  const conCoordenadas = useMemo(
    () => visibles.filter((sp) => sp.lat !== 0 || sp.lon !== 0),
    [visibles],
  )

  // Sitio pedido por la URL: se enfoca y, si esta entre los cargados, se abre su
  // detalle una sola vez (despues quien mira puede cerrarlo o elegir otro).
  const [params] = useSearchParams()
  const sitioPedido = params.get('sitio')
  const latPedida = Number(params.get('lat'))
  const lonPedida = Number(params.get('lon'))
  const enfoque =
    sitioPedido &&
    Number.isFinite(latPedida) &&
    Number.isFinite(lonPedida) &&
    (latPedida !== 0 || lonPedida !== 0)
      ? { lat: latPedida, lon: lonPedida }
      : null
  // Se deriva en vez de copiarlo a un estado: el detalle del sitio pedido se
  // muestra hasta que alguien lo cierra o elige otro punto.
  const [descartado, setDescartado] = useState<string | null>(null)
  const pedido =
    sitioPedido && descartado !== sitioPedido
      ? (conCoordenadas.find((s) => s.sitioId === sitioPedido) ?? null)
      : null
  const elegido = elegidoManual ?? pedido
  const elegir = useCallback((sp: SitioProyecto) => setElegido(sp), [])
  const cerrarDetalle = () => {
    setElegido(null)
    setDescartado(sitioPedido)
  }

  const estadoElegido = elegido ? semaforoDeSeguimiento(elegido, hoy) : null

  return (
    <>
      <CabeceraPantalla
        titulo="Mapa de sitios"
        descripcion={`${conCoordenadas.length.toLocaleString('es-CL')} sitios con coordenadas, agrupados por cercania.`}
        acciones={
          <div className="w-56">
            <Selector
              value={modo}
              onChange={(e) => setModo(e.target.value as ModoColor)}
              aria-label="Colorear el mapa por"
            >
              <option value="gate">Colorear por etapa</option>
              <option value="semaforo">Colorear por cumplimiento</option>
            </Selector>
          </div>
        }
      >
        <BarraFiltros compacta />
      </CabeceraPantalla>

      <div className="relative min-h-0 flex-1">
        {error && (
          <Aviso tono="error" className="m-3">
            {error}
          </Aviso>
        )}
        {cargando && conCoordenadas.length === 0 && (
          <div className="absolute inset-x-0 top-0 z-[500] flex justify-center p-2">
            <span className="vidrio-mapa vidrio-alzado rounded border px-3 py-1 text-xs">
              Cargando sitios…
            </span>
          </div>
        )}

        <MapContainer
          center={CENTRO}
          zoom={ZOOM}
          scrollWheelZoom
          className="size-full"
          style={{ background: 'var(--superficie-2)' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <CapaSeguimientos
            datos={conCoordenadas}
            modo={modo}
            hoy={hoy}
            etapas={etapas}
            onElegir={elegir}
          />
          <DetectorDeTeselas onFallar={marcarSinTeselas} />
          {enfoque && <EnfoqueSitio lat={enfoque.lat} lon={enfoque.lon} />}
        </MapContainer>

        {sinTeselas && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
            <p className="pointer-events-auto max-w-md rounded-lg bg-[var(--riesgo-bg)] px-3 py-2 text-xs text-[var(--riesgo-fg)] shadow-[var(--sombra-flotante)]">
              No se pudieron cargar las imágenes del mapa (sin señal, o la red bloquea
              OpenStreetMap). Los sitios siguen ubicados en sus coordenadas reales y el resto de la
              pantalla funciona igual.
            </p>
          </div>
        )}

        {/* Leyenda */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[calc(100%-1.5rem)]">
          <div className="vidrio-mapa vidrio-alzado pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-2.5 py-1.5 text-xs">
            {modo === 'gate'
              ? [...etapas.map((e) => e.codigo), CERRADO].map((g) => (
                  <span key={g} className={cn(claseGate(g, etapas), 'flex items-center gap-1')}>
                    <span aria-hidden className="punto-gate size-2 rounded-full" />
                    {nombreGate(g, etapas)}
                  </span>
                ))
              : (['atrasado', 'por_vencer', 'ok', 'sin_fecha'] as const).map((estado) => (
                  <span key={estado} className="flex items-center gap-1">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{
                        background:
                          estado === 'atrasado'
                            ? 'var(--error-fg)'
                            : estado === 'por_vencer'
                              ? 'var(--riesgo-fg)'
                              : estado === 'ok'
                                ? 'var(--ok-fg)'
                                : 'var(--texto-3)',
                      }}
                    />
                    {NOMBRES_SEMAFORO[estado]}
                  </span>
                ))}
          </div>
        </div>

        {/* Detalle del sitio elegido */}
        {elegido && (
          <aside
            aria-label={`Detalle de ${elegido.sitioId}`}
            className="vidrio-mapa vidrio-alzado absolute inset-x-3 top-3 z-[500] rounded-lg border p-3 sm:right-3 sm:left-auto sm:w-80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-texto-2">{elegido.sitioId}</p>
                <p className="truncate text-sm font-semibold">{elegido.sitioNombre}</p>
              </div>
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label="Cerrar detalle"
                onClick={cerrarDetalle}
                icono={<X aria-hidden className="size-4" />}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <InsigniaGate gate={elegido.gateActual} estado={elegido.estadoGate} />
              {estadoElegido === 'atrasado' && (
                <Insignia tono="error">{textoAtraso(atrasoDeSeguimiento(elegido, hoy))}</Insignia>
              )}
              {elegido.bloqueado && <Insignia tono="riesgo">Bloqueado</Insignia>}
            </div>

            <dl className="mt-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Comuna</dt>
                <dd>{elegido.comuna}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Programa</dt>
                <dd className="truncate">{nombrePrograma(elegido.programaId)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Proveedor</dt>
                <dd className="truncate">{nombreProveedor(elegido.proveedorId)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Etapa actual</dt>
                <dd>{nombreGate(elegido.gateActual, etapas)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Fecha plan</dt>
                <dd>{formatearFecha(elegido.fechaPlanGateActual)}</dd>
              </div>
            </dl>

            <div className="mt-2.5 flex gap-2">
              <EnlaceBoton
                to={`/seguimiento/${encodeURIComponent(elegido.id)}`}
                variante="primario"
                tamano="sm"
              >
                Abrir ficha
              </EnlaceBoton>
              <EnlaceBoton to={`/sitios/${encodeURIComponent(elegido.sitioId)}`} tamano="sm">
                <MapPin aria-hidden className="size-3.5" />
                Ver sitio
              </EnlaceBoton>
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
