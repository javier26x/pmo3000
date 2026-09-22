import { useMemo } from 'react'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { cn } from '@/components/ui'
import { CERRADO, claseGate, nombreGate, type GateActual } from '@/domain/gates/catalogo'
import { estaAtrasado } from '@/domain/vistas/filtrado'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useFiltros } from '@/hooks/useFiltros'
import { useCatalogos } from '@/hooks/useCatalogos'

interface Tramo {
  gate: GateActual
  total: number
  atrasados: number
}

/**
 * Embudo del despliegue: cuántos sitios hay parados en cada gate y qué parte de
 * ellos está atrasada.
 *
 * Es la pregunta que abre toda reunión de la PMO —«¿dónde se está atascando
 * esto?»— y con una barra proporcional se responde de un vistazo, cosa que una
 * fila de números no logra. Cada tramo filtra la vista al pulsarlo.
 */
export function EmbudoGates() {
  const { sinFiltroGate, hoy, truncado, tope, seguimientos, completando } = useDespliegue()
  const { vista, fijarVista } = useFiltros()
  const { etapas } = useCatalogos()

  const { tramos, total, atrasados, bloqueados } = useMemo(() => {
    const porGate = new Map<GateActual, SitioProyecto[]>()
    for (const sp of sinFiltroGate) {
      const lista = porGate.get(sp.gateActual)
      if (lista) lista.push(sp)
      else porGate.set(sp.gateActual, [sp])
    }

    const orden: GateActual[] = [...etapas.map((e) => e.codigo), CERRADO]
    const tramos: Tramo[] = orden.map((gate) => {
      const lista = porGate.get(gate) ?? []
      return {
        gate,
        total: lista.length,
        atrasados: lista.filter((sp) => estaAtrasado(sp, hoy)).length,
      }
    })

    return {
      tramos,
      total: sinFiltroGate.length,
      atrasados: sinFiltroGate.filter((sp) => estaAtrasado(sp, hoy)).length,
      bloqueados: sinFiltroGate.filter((sp) => sp.bloqueado).length,
    }
  }, [sinFiltroGate, hoy, etapas])

  const conSitios = tramos.filter((t) => t.total > 0)
  const numero = (n: number) => n.toLocaleString('es-CL')

  return (
    <section
      aria-label="Distribución de sitios por gate"
      className="rounded-lg border border-borde bg-superficie p-2.5"
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-xs font-semibold text-texto-2">Embudo del despliegue</h2>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          <span className="text-texto-2">
            <strong className="text-md font-semibold text-texto tabular-nums">
              {numero(total)}
            </strong>{' '}
            {truncado ? 'de ' + numero(seguimientos.length) + ' traídos' : 'sitios'}
          </span>

          {/* Los conteos todavía están creciendo: decirlo evita que alguien
              tome una cifra parcial por el total. */}
          {completando && (
            <span className="flex items-center gap-1 text-texto-3">
              <Loader2 aria-hidden className="size-3 animate-spin" />
              cargando el resto…
            </span>
          )}

          {atrasados > 0 && (
            <span className="flex items-center gap-1 text-[var(--error-fg)]">
              <AlertTriangle aria-hidden className="size-3" />
              <strong className="tabular-nums">{numero(atrasados)}</strong> atrasados
              <span className="text-texto-3">
                ({Math.round((atrasados / (total || 1)) * 100)}%)
              </span>
            </span>
          )}

          {bloqueados > 0 && (
            <span className="flex items-center gap-1 text-[var(--riesgo-fg)]">
              <Lock aria-hidden className="size-3" />
              <strong className="tabular-nums">{numero(bloqueados)}</strong> bloqueados
            </span>
          )}
        </div>

        {truncado && (
          <span className="ml-auto text-[11px] text-[var(--riesgo-fg)]">
            Vista parcial: tope de {numero(tope)} por consulta. Filtra por programa o proyecto.
          </span>
        )}
      </div>

      {conSitios.length === 0 ? (
        <div className="grid h-9 place-items-center rounded border border-dashed border-borde text-xs text-texto-3">
          Sin sitios que mostrar con estos filtros
        </div>
      ) : (
        <div className="panel-scroll flex h-9 w-full gap-0.5 overflow-x-auto rounded">
          {conSitios.map((tramo) => {
            const seleccionado = vista.gateActual === tramo.gate
            const porcentaje = Math.round((tramo.total / (total || 1)) * 100)
            const porcentajeAtraso = Math.round((tramo.atrasados / (tramo.total || 1)) * 100)

            return (
              <button
                key={tramo.gate}
                type="button"
                // `flex: n` reparte el ancho en proporción al conteo. El mínimo
                // mantiene pulsable un gate con un solo sitio y, sobre todo,
                // legible su nombre: un tracker importado trae once etapas y
                // conviviendo con otra plantilla pasan de quince, donde los
                // tramos se estrechan tanto que el nombre queda cortado por
                // ambos lados. Pasado ese punto la barra se desplaza.
                style={{ flex: `${tramo.total} 1 0`, minWidth: 58 }}
                onClick={() => fijarVista({ gateActual: seleccionado ? null : tramo.gate })}
                aria-pressed={seleccionado}
                aria-label={
                  `${nombreGate(tramo.gate, etapas)}: ${numero(tramo.total)} sitios` +
                  (tramo.atrasados > 0 ? `, ${numero(tramo.atrasados)} atrasados` : '') +
                  (seleccionado ? '. Filtro activo, pulsa para quitarlo' : '. Pulsa para filtrar')
                }
                title={
                  `${nombreGate(tramo.gate, etapas)}: ${numero(tramo.total)} sitios (${porcentaje}%)` +
                  (tramo.atrasados > 0 ? ` · ${numero(tramo.atrasados)} atrasados` : '')
                }
                className={cn(
                  claseGate(tramo.gate, etapas),
                  'insignia-gate group relative flex flex-col items-center justify-center overflow-hidden',
                  'rounded px-1 transition-[transform,filter] duration-[var(--ms-rapido)]',
                  'hover:z-10 hover:brightness-105 focus-visible:z-10',
                  seleccionado
                    ? 'ring-2 ring-[var(--acento)] ring-offset-1 ring-offset-[var(--superficie)]'
                    : 'hover:scale-[1.015]',
                )}
              >
                <span className="text-[10px] leading-none font-semibold tracking-wide">
                  {tramo.gate === CERRADO ? 'FIN' : tramo.gate}
                </span>
                <span className="text-xs leading-tight font-bold tabular-nums">
                  {numero(tramo.total)}
                </span>

                {/* Franja inferior: qué parte de este gate está atrasada. */}
                {tramo.atrasados > 0 && (
                  <span
                    aria-hidden
                    style={{ width: `${porcentajeAtraso}%` }}
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--error-fg)] opacity-80"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
