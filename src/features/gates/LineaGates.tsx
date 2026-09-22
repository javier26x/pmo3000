import { Check, Circle, CircleDot, Lock } from 'lucide-react'
import { Insignia, cn } from '@/components/ui'
import { formatearFecha } from '@/domain/fechas'
import { semaforo, textoAtraso, diasAtraso } from '@/domain/gates/atraso'
import { CERRADO, descripcionGate, type CodigoGate } from '@/domain/gates/catalogo'
import { codigosDePlantilla, gateDePlantilla, type GateTemplate } from '@/domain/tipos/gate'
import { progresoChecklist } from '@/domain/gates/maquina'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useEtapas } from '@/hooks/useCatalogos'

/**
 * Secuencia de gates del sitio. Es la pantalla que responde la pregunta de
 * siempre: en que gate esta, cuanto lleva atrasado y que le falta para pasar.
 */
export function LineaGates({
  sp,
  plantilla,
  seleccionado,
  onSeleccionar,
  hoy,
}: {
  sp: SitioProyecto
  plantilla: GateTemplate
  seleccionado: CodigoGate
  onSeleccionar: (codigo: CodigoGate) => void
  hoy: string
}) {
  const codigos = codigosDePlantilla(plantilla)
  const etapas = useEtapas()

  return (
    <ol className="flex flex-col">
      {codigos.map((codigo, i) => {
        const gate = sp.gates[codigo]
        const definicion = gateDePlantilla(plantilla, codigo)
        const esActual = sp.gateActual === codigo
        const completado = gate?.estado === 'completado'
        const progreso = progresoChecklist(gate, definicion)
        const dias = diasAtraso(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)
        const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)
        const activo = seleccionado === codigo

        return (
          <li key={codigo} className="relative">
            {i < codigos.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-8 left-[18px] h-[calc(100%-1.5rem)] w-px',
                  completado ? 'bg-[var(--ok-fg)]' : 'bg-borde',
                )}
              />
            )}

            <button
              type="button"
              onClick={() => onSeleccionar(codigo)}
              aria-current={activo ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-2.5 rounded px-2 py-2 text-left transition-colors',
                activo ? 'bg-[var(--acento-suave)]' : 'hover:bg-superficie-2',
              )}
            >
              <span
                className={cn(
                  `gate-${codigo}`,
                  'z-10 mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border',
                  completado
                    ? 'border-transparent bg-[var(--ok-fg)] text-white'
                    : esActual
                      ? 'insignia-gate border-transparent'
                      : 'border-borde bg-superficie text-texto-3',
                )}
              >
                {completado ? (
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                ) : esActual ? (
                  <CircleDot aria-hidden className="size-3.5" />
                ) : (
                  <Circle aria-hidden className="size-3" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{definicion?.nombre ?? codigo}</span>
                  {esActual && <Insignia tono="acento">Gate actual</Insignia>}
                  {esActual && sp.bloqueado && (
                    <Insignia tono="riesgo">
                      <Lock aria-hidden className="size-3" />
                      Bloqueado
                    </Insignia>
                  )}
                  {esActual && estado === 'atrasado' && (
                    <Insignia tono="error">{textoAtraso(dias)}</Insignia>
                  )}
                </span>

                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-texto-2">
                  <span>Plan {formatearFecha(gate?.fechaPlan ?? null)}</span>
                  <span>Real {formatearFecha(gate?.fechaReal ?? null)}</span>
                  {progreso.total > 0 && (
                    <span
                      className={
                        progreso.obligatoriosPendientes > 0 ? 'text-texto-3' : 'text-[var(--ok-fg)]'
                      }
                    >
                      {progreso.completados}/{progreso.total} entregables
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}

      <li className="relative">
        <div
          className={cn(
            'flex items-center gap-2.5 px-2 py-2',
            sp.gateActual === CERRADO ? 'text-[var(--ok-fg)]' : 'text-texto-3',
          )}
        >
          <span
            className={cn(
              'grid size-[22px] shrink-0 place-items-center rounded-full border',
              sp.gateActual === CERRADO
                ? 'border-transparent bg-[var(--ok-fg)] text-white'
                : 'border-dashed border-borde',
            )}
          >
            <Check aria-hidden className="size-3.5" strokeWidth={3} />
          </span>
          <span className="text-sm font-semibold">
            {sp.gateActual === CERRADO ? 'Sitio cerrado' : 'Cierre'}
          </span>
        </div>
      </li>

      <li className="mt-2 border-t border-borde px-2 pt-2">
        <p className="text-xs leading-relaxed text-texto-3">
          {descripcionGate(seleccionado, etapas)}
        </p>
      </li>
    </ol>
  )
}
