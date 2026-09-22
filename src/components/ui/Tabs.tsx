import { cn } from './utilidades'

export interface Pestana<T extends string> {
  id: T
  etiqueta: string
  conteo?: number
}

/** Pestanas accesibles: rol tablist y navegacion con flechas del teclado. */
export function Tabs<T extends string>({
  pestanas,
  activa,
  onCambiar,
  className,
}: {
  pestanas: readonly Pestana<T>[]
  activa: T
  onCambiar: (id: T) => void
  className?: string
}) {
  const alTeclear = (e: React.KeyboardEvent, indice: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const paso = e.key === 'ArrowRight' ? 1 : -1
    const siguiente = pestanas[(indice + paso + pestanas.length) % pestanas.length]
    if (siguiente) onCambiar(siguiente.id)
  }

  return (
    <div role="tablist" className={cn('flex items-center gap-1', className)}>
      {pestanas.map((p, i) => {
        const activo = p.id === activa
        return (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onCambiar(p.id)}
            onKeyDown={(e) => alTeclear(e, i)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors',
              activo
                ? 'bg-superficie-3 text-texto'
                : 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
            )}
          >
            {p.etiqueta}
            {p.conteo !== undefined && (
              <span className="text-xs text-texto-3 tabular-nums">{p.conteo}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
