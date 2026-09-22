import { CERRADO, claseGate, nombreGate, type GateActual } from '@/domain/gates/catalogo'
import { useEtapas } from '@/hooks/useCatalogos'
import { NOMBRES_ESTADO_GATE, type EstadoGate } from '@/domain/tipos/comunes'
import { cn } from './utilidades'

/** Insignia coloreada por gate. El color es consistente en tabla, mapa y kanban. */
export function InsigniaGate({
  gate,
  estado,
  className,
}: {
  gate: GateActual
  estado?: EstadoGate | undefined
  className?: string | undefined
}) {
  const etapas = useEtapas()
  const nombre = nombreGate(gate, etapas)
  return (
    <span
      title={estado ? `${nombre} — ${NOMBRES_ESTADO_GATE[estado]}` : nombre}
      className={cn(
        claseGate(gate, etapas),
        'insignia-gate inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      {gate === CERRADO ? 'Cerrado' : gate}
    </span>
  )
}

export function PuntoGate({ gate, className }: { gate: GateActual; className?: string }) {
  const etapas = useEtapas()
  return (
    <span
      aria-hidden
      className={cn(
        claseGate(gate, etapas),
        'punto-gate inline-block size-2 shrink-0 rounded-full',
        className,
      )}
    />
  )
}
