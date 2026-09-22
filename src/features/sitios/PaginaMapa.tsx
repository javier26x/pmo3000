import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { NOMBRES_SEMAFORO, semaforo, textoAtraso } from '@/domain/gates/atraso'
import { CERRADO, CODIGOS_GATE, nombreGate } from '@/domain/gates/catalogo'
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

function CapaSeguimientos({
  datos,
  modo,
  hoy,
  onElegir,
}: {
  datos: SitioProyecto[]
  modo: ModoColor
  hoy: string
  onElegir: (sp: SitioProyecto) => void
}) {
  const mapa = useMap()
  const tema = usarTema((e) => e.tema)
  const grupoRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    // Clustering obligatorio: 4.500 marcadores sueltos dejan el mapa inservible.
    const grupo = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
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

    const paleta = leerPaleta()
    grupo.clearLayers()

    const marcadores = datos
      .filter((sp) => Number.isFinite(sp.lat) && Number.isFinite(sp.lon))
      .map((sp) => {
        const gate = sp.gateActual === CERRADO ? null : sp.gates[sp.gateActual]
        const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)
        const color =
          modo === 'gate'
            ? (paleta.gate[sp.gateActual] ?? '#888')
            : (paleta.semaforo[estado] ?? '#888')

        const marcador = L.circleMarker([sp.lat, sp.lon], {
          radius: 6,
          weight: 1.5,
          color: '#ffffff',
          fillColor: color,
          fillOpacity: 0.95,
        })

        marcador.bindTooltip(`${sp.sitioId} — ${sp.sitioNombre}`, { direction: 'top' })
        // El detalle se muestra en un panel de React (no en un popup de Leaflet)
        // para poder navegar con el router y que funcione bien en celular.
        marcador.on('click', () => onElegir(sp))
        return marcador
      })

    grupo.addLayers(marcadores)
  }, [datos, modo, hoy, tema, onElegir])

  return null
}

export default function PaginaMapa() {
  const { visibles, cargando, error, hoy } = useDespliegue()
  const { nombrePrograma, nombreProveedor } = useCatalogos()
  const [modo, setModo] = useState<ModoColor>('gate')
  useTituloPagina('Mapa')
  const [elegido, setElegido] = useState<SitioProyecto | null>(null)
  const [sinTeselas, setSinTeselas] = useState(false)
  const marcarSinTeselas = useCallback(() => setSinTeselas(true), [])

  const conCoordenadas = useMemo(
    () => visibles.filter((sp) => sp.lat !== 0 || sp.lon !== 0),
    [visibles],
  )

  const gateElegido = elegido
    ? elegido.gateActual === CERRADO
      ? null
      : elegido.gates[elegido.gateActual]
    : null
  const estadoElegido = elegido
    ? semaforo(gateElegido?.fechaPlan ?? null, gateElegido?.fechaReal ?? null, hoy)
    : null

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
              <option value="gate">Colorear por gate</option>
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
            <span className="rounded bg-superficie px-3 py-1 text-xs shadow-[var(--sombra)]">
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
          <CapaSeguimientos datos={conCoordenadas} modo={modo} hoy={hoy} onElegir={setElegido} />
          <DetectorDeTeselas onFallar={marcarSinTeselas} />
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
          <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-borde bg-superficie/95 px-2.5 py-1.5 text-xs shadow-[var(--sombra)] backdrop-blur">
            {modo === 'gate'
              ? [...CODIGOS_GATE, CERRADO].map((g) => (
                  <span key={g} className={cn(`gate-${g}`, 'flex items-center gap-1')}>
                    <span aria-hidden className="punto-gate size-2 rounded-full" />
                    {g === CERRADO ? 'Cerrado' : g}
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
            className="absolute inset-x-3 top-3 z-[500] rounded-lg border border-borde bg-superficie p-3 shadow-[var(--sombra-flotante)] sm:right-3 sm:left-auto sm:w-80"
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
                onClick={() => setElegido(null)}
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
                <dt className="text-texto-3">Gate actual</dt>
                <dd>{nombreGate(elegido.gateActual)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-texto-3">Fecha plan</dt>
                <dd>{formatearFecha(gateElegido?.fechaPlan ?? null)}</dd>
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
