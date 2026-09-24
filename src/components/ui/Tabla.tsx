import type { ReactNode, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from './utilidades'

export function ContenedorTabla({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'panel-scroll min-h-0 flex-1 overflow-auto rounded-[var(--radio-lg)] border border-borde bg-superficie',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Encabezado({
  children,
  className,
  alineacion = 'izquierda',
  ordenable = false,
  direccion,
  onOrdenar,
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement> & {
  alineacion?: 'izquierda' | 'derecha' | 'centro'
  ordenable?: boolean
  direccion?: 'asc' | 'desc' | null | undefined
  onOrdenar?: (() => void) | undefined
}) {
  const alineaciones = {
    izquierda: 'text-left',
    derecha: 'text-right',
    centro: 'text-center',
  }

  return (
    <th
      scope="col"
      aria-sort={
        !ordenable
          ? undefined
          : direccion === 'asc'
            ? 'ascending'
            : direccion === 'desc'
              ? 'descending'
              : 'none'
      }
      className={cn(
        // Aqui el vidrio gana algo real: las filas pasan por debajo al desplazar.
        'vidrio-sutil sticky top-0 z-10 border-b border-borde px-2 py-1.5',
        'text-xs font-semibold text-texto-2 whitespace-nowrap',
        alineaciones[alineacion],
        className,
      )}
      {...resto}
    >
      {ordenable ? (
        <button
          type="button"
          onClick={onOrdenar}
          className={cn(
            'inline-flex items-center gap-1 rounded hover:text-texto',
            alineacion === 'derecha' && 'flex-row-reverse',
          )}
        >
          {children}
          {direccion === 'asc' ? (
            <ArrowUp aria-hidden className="size-3" />
          ) : direccion === 'desc' ? (
            <ArrowDown aria-hidden className="size-3" />
          ) : (
            <span aria-hidden className="size-3" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Celda({
  children,
  className,
  alineacion = 'izquierda',
  titulo,
  colSpan,
}: {
  children?: ReactNode
  className?: string | undefined
  alineacion?: 'izquierda' | 'derecha' | 'centro'
  titulo?: string | undefined
  colSpan?: number | undefined
}) {
  const alineaciones = {
    izquierda: 'text-left',
    derecha: 'text-right',
    centro: 'text-center',
  }
  return (
    <td
      title={titulo}
      colSpan={colSpan}
      className={cn('truncate px-2 text-sm', alineaciones[alineacion], className)}
    >
      {children}
    </td>
  )
}
