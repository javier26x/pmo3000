import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Database, Upload } from 'lucide-react'
import {
  Aviso,
  CabeceraPantalla,
  Celda,
  EnlaceBoton,
  Encabezado,
  EstadoVacio,
} from '@/components/ui'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useFiltros } from '@/hooks/useFiltros'
import { useEsMovil } from '@/hooks/useMedia'
import { useSesion } from '@/hooks/useSesion'
import { escribiendoEnCampo } from '@/app/atajos'
import { recordarSitio } from '@/app/sitiosRecientes'
import type { CampoOrden } from '@/domain/vistas/filtrado'
import { torreraDe } from '@/domain/vistas/torrera'
import { BarraFiltros } from './BarraFiltros'
import { EmbudoGates } from './EmbudoGates'
import { useMedidorSla } from '@/hooks/useSla'
import {
  FilaEsqueleto,
  FilaSeguimiento,
  TarjetaSeguimiento,
  type DatosFila,
} from './FilaSeguimiento'

const COLUMNAS: { campo: CampoOrden | null; etiqueta: string; alineacion?: 'derecha' }[] = [
  { campo: 'sitio', etiqueta: 'ID sitio' },
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'region', etiqueta: 'Comuna' },
  { campo: null, etiqueta: 'Programa' },
  { campo: null, etiqueta: 'Torrera' },
  { campo: 'gate', etiqueta: 'Etapa' },
  { campo: 'plan', etiqueta: 'Fecha plan', alineacion: 'derecha' },
  { campo: 'atraso', etiqueta: 'Desviación', alineacion: 'derecha' },
  { campo: null, etiqueta: 'SLA etapa', alineacion: 'derecha' },
  { campo: null, etiqueta: 'Estado' },
  { campo: null, etiqueta: 'Proveedor' },
  { campo: null, etiqueta: 'Responsable' },
  { campo: 'prioridad', etiqueta: 'Prioridad' },
]

export function PaginaSitios() {
  const { puedeHacer } = useSesion()
  const { nombrePrograma, nombreProveedor, nombreUsuario } = useCatalogos()
  const { visibles, cargando, error, hoy, seguimientos } = useDespliegue()
  const medirSla = useMedidorSla()
  const { orden, alternarOrden } = useFiltros()
  const esMovil = useEsMovil()
  useTituloPagina('Sitios')
  const navegar = useNavigate()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState(0)

  const filas = useMemo<DatosFila[]>(
    () =>
      visibles.map((sp) => ({
        sp,
        nombrePrograma: nombrePrograma(sp.programaId),
        torrera: torreraDe(sp.valores),
        nombreProveedor: nombreProveedor(sp.proveedorId),
        nombreResponsable: nombreUsuario(sp.responsableUid),
        sla: medirSla(sp, hoy),
        hoy,
      })),
    [visibles, nombrePrograma, nombreProveedor, nombreUsuario, medirSla, hoy],
  )

  // Virtualización: con 4.500 filas, el DOM completo hace inusable el scroll.
  // En escritorio la fila tiene alto fijo; en celular la tarjeta crece según el
  // texto, así que se mide cada una para que no se solapen.
  const virtualizador = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => (esMovil ? 92 : 34),
    overscan: 14,
    ...(esMovil ? { measureElement: (el: Element) => el.getBoundingClientRect().height } : {}),
  })

  const abrir = useCallback(
    (datos: DatosFila) => {
      recordarSitio(datos.sp.sitioId)
      navegar(`/seguimiento/${encodeURIComponent(datos.sp.id)}`)
    },
    [navegar],
  )

  // El cursor se acota en el render: si la lista se filtró, no puede quedar
  // apuntando a una fila que ya no existe.
  const posicion = filas.length === 0 ? 0 : Math.min(cursor, filas.length - 1)

  const mover = useCallback(
    (delta: number) => {
      const siguiente = Math.max(0, Math.min(posicion + delta, filas.length - 1))
      setCursor(siguiente)
      virtualizador.scrollToIndex(siguiente, { align: 'auto' })
    },
    [posicion, filas.length, virtualizador],
  )

  useEffect(() => {
    if (esMovil) return

    const alTeclear = (e: KeyboardEvent) => {
      if (escribiendoEnCampo(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      const tecla = e.key
      if (tecla === 'j' || tecla === 'ArrowDown') {
        e.preventDefault()
        mover(1)
      } else if (tecla === 'k' || tecla === 'ArrowUp') {
        e.preventDefault()
        mover(-1)
      } else if (tecla === 'Home') {
        e.preventDefault()
        mover(-filas.length)
      } else if (tecla === 'End') {
        e.preventDefault()
        mover(filas.length)
      } else if (tecla === 'Enter') {
        const elegida = filas[posicion]
        if (elegida) {
          e.preventDefault()
          abrir(elegida)
        }
      }
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [esMovil, mover, filas, posicion, abrir])

  const items = virtualizador.getVirtualItems()
  const relleno = {
    antes: items[0]?.start ?? 0,
    despues: virtualizador.getTotalSize() - (items[items.length - 1]?.end ?? 0),
  }

  const cargandoInicial = cargando && filas.length === 0

  return (
    <>
      <CabeceraPantalla
        titulo="Maestro de sitios"
        descripcion="Cada fila es un sitio dentro de un proyecto, con su etapa actual y su desviación."
        acciones={
          puedeHacer('sitios', 'importar') ? (
            <EnlaceBoton to="/importar" variante="primario">
              <Upload aria-hidden className="size-4" />
              Importar
            </EnlaceBoton>
          ) : undefined
        }
      >
        <BarraFiltros />
      </CabeceraPantalla>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <EmbudoGates />

        {error && (
          <Aviso tono="error" titulo="No pudimos cargar el seguimiento">
            {error}
          </Aviso>
        )}

        {!cargandoInicial && filas.length === 0 ? (
          <EstadoVacio
            icono={<Database aria-hidden className="size-8" />}
            titulo={
              seguimientos.length === 0
                ? 'Todavía no hay sitios en seguimiento'
                : 'Ningún sitio coincide con los filtros'
            }
            descripcion={
              seguimientos.length === 0
                ? 'Importa el maestro desde Excel o CSV para empezar.'
                : 'Ajusta o limpia los filtros para ver más resultados.'
            }
            accion={
              seguimientos.length === 0 && puedeHacer('sitios', 'importar') ? (
                <EnlaceBoton to="/importar" variante="primario">
                  Ir al importador
                </EnlaceBoton>
              ) : undefined
            }
          />
        ) : esMovil ? (
          <div
            ref={contenedorRef}
            className="panel-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-borde bg-superficie"
          >
            <div style={{ height: virtualizador.getTotalSize(), position: 'relative' }}>
              {items.map((item) => {
                const datos = filas[item.index]
                if (!datos) return null
                return (
                  <div
                    key={datos.sp.id}
                    ref={virtualizador.measureElement}
                    data-index={item.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    <TarjetaSeguimiento datos={datos} />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div
            ref={contenedorRef}
            className="panel-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-borde bg-superficie"
          >
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Sitios en seguimiento con su gate actual, fecha plan y desviación. Usa J y K para
                recorrer las filas y Enter para abrir la ficha.
              </caption>
              <thead>
                <tr>
                  {COLUMNAS.map((col, i) => (
                    <Encabezado
                      key={col.etiqueta}
                      alineacion={col.alineacion === 'derecha' ? 'derecha' : 'izquierda'}
                      ordenable={col.campo !== null}
                      direccion={orden.campo === col.campo ? orden.direccion : null}
                      onOrdenar={
                        col.campo ? () => alternarOrden(col.campo as CampoOrden) : undefined
                      }
                      className={i === 0 ? 'sticky left-0 z-20' : undefined}
                    >
                      {col.etiqueta}
                    </Encabezado>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargandoInicial ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <FilaEsqueleto key={i} columnas={COLUMNAS.length} />
                  ))
                ) : (
                  <>
                    {relleno.antes > 0 && (
                      <tr aria-hidden style={{ height: relleno.antes }}>
                        <Celda className="p-0" colSpan={COLUMNAS.length} />
                      </tr>
                    )}
                    {items.map((item) => {
                      const datos = filas[item.index]
                      return datos ? (
                        <FilaSeguimiento
                          key={datos.sp.id}
                          datos={datos}
                          conCursor={item.index === posicion}
                          onApuntar={() => setCursor(item.index)}
                          onActivar={() => abrir(datos)}
                        />
                      ) : null
                    })}
                    {relleno.despues > 0 && (
                      <tr aria-hidden style={{ height: relleno.despues }}>
                        <Celda className="p-0" colSpan={COLUMNAS.length} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
