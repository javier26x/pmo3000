import { CERRADO, nombreGate, type GateActual } from '@/domain/gates/catalogo'
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
  return (
    <span
      title={estado ? `${nombreGate(gate)} — ${NOMBRES_ESTADO_GATE[estado]}` : nombreGate(gate)}
      className={cn(
        `gate-${gate}`,
        'insignia-gate inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      {gate === CERRADO ? 'Cerrado' : gate}
    </span>
  )
}

export function PuntoGate({ gate, className }: { gate: GateActual; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        `gate-${gate}`,
        'punto-gate inline-block size-2 shrink-0 rounded-full',
        className,
      )}
    />
  )
}
