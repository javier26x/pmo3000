import type { ReactNode } from 'react'
import type { TonoInsignia } from '@/components/ui'
import type { EstadoPrograma } from '@/domain/tipos'

export const TONO_ESTADO: Record<EstadoPrograma, TonoInsignia> = {
  planificado: 'info',
  en_curso: 'ok',
  en_riesgo: 'riesgo',
  cerrado: 'neutro',
}

/** Un bloque de la ficha: titulo, para que sirve y, si se puede, su accion. */
export function Bloque({
  icono,
  titulo,
  descripcion,
  accion,
  children,
  className,
}: {
  icono: ReactNode
  titulo: string
  descripcion?: string
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={titulo}
      className={`overflow-hidden rounded-lg border border-borde bg-superficie ${className ?? ''}`}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-borde px-3 py-2.5">
        <span className="mt-0.5 text-texto-3">{icono}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-md">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-texto-2">{descripcion}</p>}
        </div>
        {accion}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}
