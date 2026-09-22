import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Database, Upload } from 'lucide-react'
import {
  Aviso,
  CabeceraPantalla,
  Cargando,
  Celda,
  EnlaceBoton,
  Encabezado,
  EstadoVacio,
} from '@/components/ui'
import { usarFiltros } from '@/app/filtros'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useEsMovil } from '@/hooks/useMedia'
import { useSesion } from '@/hooks/useSesion'
import type { CampoOrden } from '@/domain/vistas/filtrado'
import { BarraFiltros } from './BarraFiltros'
import { FilaSeguimiento, TarjetaSeguimiento, type DatosFila } from './FilaSeguimiento'

const COLUMNAS: { campo: CampoOrden | null; etiqueta: string; alineacion?: 'derecha' }[] = [
  { campo: 'sitio', etiqueta: 'ID sitio' },
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'region', etiqueta: 'Comuna' },
  { campo: null, etiqueta: 'Programa' },
  { campo: 'gate', etiqueta: 'Gate' },
  { campo: 'plan', etiqueta: 'Fecha plan', alineacion: 'derecha' },
  { campo: 'atraso', etiqueta: 'Desviacion', alineacion: 'derecha' },
  { campo: null, etiqueta: 'Estado' },
  { campo: null, etiqueta: 'Proveedor' },
  { campo: null, etiqueta: 'Responsable' },
  { campo: 'prioridad', etiqueta: 'Prioridad' },
]

export function PaginaSitios() {
  const { puedeHacer } = useSesion()
  const { nombrePrograma, nombreProveedor, nombreUsuario } = useCatalogos()
  const { visibles, cargando, error, hoy, seguimientos } = useDespliegue()
  const orden = usarFiltros((e) => e.orden)
  const alternarOrden = usarFiltros((e) => e.alternarOrden)
  const esMovil = useEsMovil()
  const contenedorRef = useRef<HTMLDivElement>(null)

  const filas = useMemo<DatosFila[]>(
    () =>
      visibles.map((sp) => ({
        sp,
        nombrePrograma: nombrePrograma(sp.programaId),
        nombreProveedor: nombreProveedor(sp.proveedorId),
        nombreResponsable: nombreUsuario(sp.responsableUid),
        hoy,
      })),
    [visibles, nombrePrograma, nombreProveedor, nombreUsuario, hoy],
  )

  // Virtualizacion: con 4.500 filas el DOM completo hace inusable el scroll.
  // En escritorio la fila tiene alto fijo; en celular la tarjeta crece segun el
  // texto, asi que se mide cada una (measureElement) para que no se solapen.
  const virtualizador = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => (esMovil ? 92 : 34),
    overscan: 14,
    ...(esMovil ? { measureElement: (el: Element) => el.getBoundingClientRect().height } : {}),
  })

  const items = virtualizador.getVirtualItems()
  const relleno = {
    antes: items[0]?.start ?? 0,
    despues: virtualizador.getTotalSize() - (items[items.length - 1]?.end ?? 0),
  }

  return (
    <>
      <CabeceraPantalla
        titulo="Maestro de sitios"
        descripcion="Cada fila es un sitio dentro de un proyecto, con su gate actual y su desviacion."
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

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {error && (
          <Aviso tono="error" titulo="No pudimos cargar el seguimiento" className="mb-3">
            {error}
          </Aviso>
        )}

        {cargando && filas.length === 0 ? (
          <Cargando texto="Cargando sitios…" />
        ) : filas.length === 0 ? (
          <EstadoVacio
            icono={<Database aria-hidden className="size-8" />}
            titulo={
              seguimientos.length === 0
                ? 'Todavia no hay sitios en seguimiento'
                : 'Ningun sitio coincide con los filtros'
            }
            descripcion={
              seguimientos.length === 0
                ? 'Importa el maestro desde Excel o CSV para empezar.'
                : 'Ajusta o limpia los filtros para ver mas resultados.'
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
            className="panel-scroll min-h-0 flex-1 overflow-y-auto rounded border border-borde bg-superficie"
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
            className="panel-scroll min-h-0 flex-1 overflow-auto rounded border border-borde bg-superficie"
          >
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Sitios en seguimiento con su gate actual, fecha plan y desviacion
              </caption>
              <thead>
                <tr>
                  {COLUMNAS.map((col) => (
                    <Encabezado
                      key={col.etiqueta}
                      alineacion={col.alineacion === 'derecha' ? 'derecha' : 'izquierda'}
                      ordenable={col.campo !== null}
                      direccion={orden.campo === col.campo ? orden.direccion : null}
                      onOrdenar={
                        col.campo ? () => alternarOrden(col.campo as CampoOrden) : undefined
                      }
                    >
                      {col.etiqueta}
                    </Encabezado>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relleno.antes > 0 && (
                  <tr aria-hidden style={{ height: relleno.antes }}>
                    <Celda className="p-0" colSpan={COLUMNAS.length} />
                  </tr>
                )}
                {items.map((item) => {
                  const datos = filas[item.index]
                  return datos ? <FilaSeguimiento key={datos.sp.id} datos={datos} /> : null
                })}
                {relleno.despues > 0 && (
                  <tr aria-hidden style={{ height: relleno.despues }}>
                    <Celda className="p-0" colSpan={COLUMNAS.length} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
