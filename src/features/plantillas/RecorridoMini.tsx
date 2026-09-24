import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui'
import { etapasDelCarril } from '@/domain/plantillas/edicion'
import type { GatePlantilla } from '@/domain/tipos/gate'

/**
 * El recorrido de una plantilla en una linea: las etapas en orden, unidas por
 * flechas, y aparte lo que corre en paralelo. Solo lectura; es lo que se ve en
 * las listas antes de abrir el editor.
 */
export function RecorridoMini({
  etapas,
  nombre,
  className,
}: {
  etapas: readonly GatePlantilla[]
  /** Para el lector de pantalla: "Recorrido de <nombre>". */
  nombre: string
  className?: string
}) {
  const ordenadas = [...etapas].sort((a, b) => a.orden - b.orden)
  const recorrido = etapasDelCarril(ordenadas, 'secuencial')
  const paralelas = etapasDelCarril(ordenadas, 'paralela')

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <ol aria-label={`Recorrido de ${nombre}`} className="flex flex-wrap items-center gap-y-1">
        {recorrido.map((g, i) => (
          <Fragment key={g.codigo}>
            {i > 0 && (
              <ChevronRight aria-hidden className="mx-0.5 size-3.5 shrink-0 text-texto-3" />
            )}
            <li
              className={cn(
                `gate-${g.color}`,
                'insignia-gate inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
              )}
            >
              <span className="tabular-nums opacity-70">{i + 1}</span>
              {g.nombre}
            </li>
          </Fragment>
        ))}
      </ol>
      {paralelas.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-texto-3">
          <span>En paralelo:</span>
          {paralelas.map((g) => (
            <span
              key={g.codigo}
              className={cn(
                `gate-${g.color}`,
                'inline-flex items-center gap-1 rounded border border-dashed border-borde-fuerte px-1.5 py-0.5 text-texto-2',
              )}
            >
              <span aria-hidden className="punto-gate size-1.5 rounded-full" />
              {g.nombre}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
