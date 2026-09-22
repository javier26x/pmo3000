import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Celda, Encabezado, EstadoVacio, Insignia } from '@/components/ui'
import { formatearFecha } from '@/domain/fechas'
import type { EstadoFila, FilaImportacion } from '@/domain/importacion'

const TONO_ESTADO: Record<EstadoFila, 'ok' | 'info' | 'riesgo' | 'error'> = {
  nuevo: 'ok',
  actualiza: 'info',
  duplicado_archivo: 'riesgo',
  error: 'error',
}

const TEXTO_ESTADO: Record<EstadoFila, string> = {
  nuevo: 'Nuevo',
  actualiza: 'Actualiza',
  duplicado_archivo: 'Duplicado',
  error: 'Error',
}

/** Vista previa de la importacion. Virtualizada: el archivo real trae miles de filas. */
export function TablaPrevia({
  filas,
  soloProblemas,
}: {
  filas: FilaImportacion[]
  soloProblemas: boolean
}) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  const mostradas = useMemo(
    () =>
      soloProblemas ? filas.filter((f) => f.errores.length > 0 || f.avisos.length > 0) : filas,
    [filas, soloProblemas],
  )

  const virtualizador = useVirtualizer({
    count: mostradas.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => 34,
    overscan: 12,
  })

  const items = virtualizador.getVirtualItems()
  const antes = items[0]?.start ?? 0
  const despues = virtualizador.getTotalSize() - (items[items.length - 1]?.end ?? 0)

  if (mostradas.length === 0) {
    return (
      <EstadoVacio
        titulo={
          soloProblemas ? 'Ninguna fila tiene problemas' : 'El archivo no tiene filas con datos'
        }
        descripcion={
          soloProblemas
            ? 'Todas las filas del archivo pasaron la validacion.'
            : 'Revisa que la primera fila sea la cabecera y que haya datos debajo.'
        }
      />
    )
  }

  return (
    <div
      ref={contenedorRef}
      className="panel-scroll min-h-64 flex-1 overflow-auto rounded border border-borde bg-superficie"
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Vista previa de la importacion, con el estado y los problemas de cada fila
        </caption>
        <thead>
          <tr>
            <Encabezado alineacion="derecha">Fila</Encabezado>
            <Encabezado>Estado</Encabezado>
            <Encabezado>ID sitio</Encabezado>
            <Encabezado>Nombre</Encabezado>
            <Encabezado>Comuna</Encabezado>
            <Encabezado alineacion="derecha">Lat</Encabezado>
            <Encabezado alineacion="derecha">Lon</Encabezado>
            <Encabezado>Programa</Encabezado>
            <Encabezado>Inicio</Encabezado>
            <Encabezado>Problemas</Encabezado>
          </tr>
        </thead>
        <tbody>
          {antes > 0 && (
            <tr aria-hidden style={{ height: antes }}>
              <Celda colSpan={10} className="p-0" />
            </tr>
          )}

          {items.map((item) => {
            const fila = mostradas[item.index]
            if (!fila) return null
            const problemas = [...fila.errores, ...fila.avisos]
            return (
              <tr
                key={`${fila.numeroFila}-${item.index}`}
                style={{ height: 'var(--alto-fila)' }}
                className="border-b border-borde last:border-0"
              >
                <Celda alineacion="derecha" className="text-texto-3 tabular-nums">
                  {fila.numeroFila}
                </Celda>
                <Celda>
                  <Insignia tono={TONO_ESTADO[fila.estado]}>{TEXTO_ESTADO[fila.estado]}</Insignia>
                </Celda>
                <Celda className="font-mono text-xs">{fila.sitio?.id ?? '—'}</Celda>
                <Celda className="max-w-44" titulo={fila.sitio?.nombre}>
                  {fila.sitio?.nombre ?? '—'}
                </Celda>
                <Celda className="max-w-32 text-texto-2">{fila.sitio?.comuna ?? '—'}</Celda>
                <Celda alineacion="derecha" className="text-texto-2 tabular-nums">
                  {fila.sitio?.lat.toFixed(4) ?? '—'}
                </Celda>
                <Celda alineacion="derecha" className="text-texto-2 tabular-nums">
                  {fila.sitio?.lon.toFixed(4) ?? '—'}
                </Celda>
                <Celda className="max-w-32 text-texto-2">{fila.programa ?? '—'}</Celda>
                <Celda className="text-texto-2 tabular-nums">
                  {formatearFecha(fila.fechaInicio)}
                </Celda>
                <Celda className="max-w-80" titulo={problemas.map((p) => p.mensaje).join(' · ')}>
                  <span
                    className={
                      fila.errores.length > 0 ? 'text-[var(--error-fg)]' : 'text-[var(--riesgo-fg)]'
                    }
                  >
                    {problemas.map((p) => p.mensaje).join(' · ') || '—'}
                  </span>
                </Celda>
              </tr>
            )
          })}

          {despues > 0 && (
            <tr aria-hidden style={{ height: despues }}>
              <Celda colSpan={10} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
