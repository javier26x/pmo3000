import { memo } from 'react'
import { Link } from 'react-router'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Lock } from 'lucide-react'
import { Insignia, cn } from '@/components/ui'
import { formatearFecha } from '@/domain/fechas'
import { textoAtraso } from '@/domain/gates/atraso'
import { NOMBRES_PRIORIDAD } from '@/domain/tipos/comunes'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { atrasoDeSeguimiento, semaforoDeSeguimiento } from '@/domain/vistas/filtrado'

const TONO_PRIORIDAD = {
  critica: 'error',
  alta: 'riesgo',
  media: 'neutro',
  baja: 'neutro',
} as const

/** Memoizada: durante un arrastre el kanban se repinta entero y las tarjetas
 *  que no se mueven no tienen por qué rehacerse. */
export const TarjetaKanban = memo(function TarjetaKanban({
  sp,
  hoy,
  arrastrable,
  nombreProveedor,
}: {
  sp: SitioProyecto
  hoy: string
  arrastrable: boolean
  nombreProveedor: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sp.id,
    disabled: !arrastrable,
  })

  const dias = atrasoDeSeguimiento(sp, hoy)
  const estado = semaforoDeSeguimiento(sp, hoy)

  return (
    <article
      ref={setNodeRef}
      title={nombreProveedor || undefined}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        'rounded border border-borde bg-superficie px-2 py-1.5 shadow-[var(--sombra)]',
        isDragging && 'z-50 opacity-90 ring-2 ring-[var(--acento)]',
        estado === 'atrasado' && 'border-l-2 border-l-[var(--error-fg)]',
      )}
    >
      {/* Dos lineas y no cuatro: con la tarjeta alta cabian cuatro por columna
          en un notebook. El proveedor queda en el title de la tarjeta. */}
      <div className="flex items-center gap-1.5">
        {arrastrable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover ${sp.sitioId} de gate`}
            className="shrink-0 cursor-grab rounded text-texto-3 hover:text-texto active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-3.5" />
          </button>
        )}
        <Link
          to={`/seguimiento/${encodeURIComponent(sp.id)}`}
          className="shrink-0 rounded font-mono text-xs text-[var(--acento)] hover:underline"
        >
          {sp.sitioId}
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={sp.sitioNombre}>
          {sp.sitioNombre}
        </p>
        {sp.bloqueado && (
          <Lock aria-label="Bloqueado" className="size-3 shrink-0 text-[var(--riesgo-fg)]" />
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-texto-3">
        <Insignia tono={TONO_PRIORIDAD[sp.prioridad]}>{NOMBRES_PRIORIDAD[sp.prioridad]}</Insignia>
        {estado === 'atrasado' ? (
          <Insignia tono="error">{textoAtraso(dias)}</Insignia>
        ) : estado === 'por_vencer' ? (
          <Insignia tono="riesgo">{textoAtraso(dias)}</Insignia>
        ) : null}
        <span className="min-w-0 truncate">
          {sp.comuna} · Plan {formatearFecha(sp.fechaPlanGateActual)}
        </span>
      </div>
    </article>
  )
})
