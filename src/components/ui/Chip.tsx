import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './utilidades'

/**
 * Chip de filtro activo. Muestra campo y valor, y se quita con un clic o con
 * Retroceso/Suprimir cuando tiene el foco.
 */
export function Chip({
  campo,
  valor,
  onQuitar,
  onAbrir,
  icono,
  className,
}: {
  campo: string
  valor: ReactNode
  onQuitar: () => void
  onAbrir?: () => void
  icono?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'anim-aparecer inline-flex h-7 items-center overflow-hidden rounded border',
        'border-[var(--acento-borde)] bg-[var(--acento-suave)] text-xs',
        className,
      )}
    >
      <button
        type="button"
        onClick={onAbrir}
        disabled={!onAbrir}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            onQuitar()
          }
        }}
        className={cn(
          'flex h-full items-center gap-1.5 px-2 transition-colors duration-[var(--ms-instante)]',
          onAbrir && 'hover:bg-[var(--acento-borde)]',
        )}
      >
        {icono && <span className="text-[var(--acento)]">{icono}</span>}
        <span className="text-texto-2">{campo}</span>
        <span className="max-w-40 truncate font-medium text-texto">{valor}</span>
      </button>

      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar filtro ${campo}`}
        className="flex h-full items-center border-l border-[var(--acento-borde)] px-1.5 text-texto-2 transition-colors duration-[var(--ms-instante)] hover:bg-[var(--acento-borde)] hover:text-texto"
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  )
}
