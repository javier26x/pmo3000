import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from './utilidades'

export interface Miga {
  etiqueta: string
  ruta?: string
}

/** Cabecera de pantalla: titulo, migas y acciones. Altura fija para no saltar. */
export function CabeceraPantalla({
  titulo,
  migas = [],
  descripcion,
  acciones,
  ancho,
  children,
}: {
  titulo: ReactNode
  migas?: Miga[]
  descripcion?: ReactNode | undefined
  acciones?: ReactNode | undefined
  /** Ancho maximo del contenido (p. ej. 'max-w-6xl'): alinea la cabecera con una ficha centrada. */
  ancho?: string | undefined
  children?: ReactNode | undefined
}) {
  return (
    <div className="shrink-0 border-b border-[var(--vidrio-divisor)] px-4 py-3">
      <div className={cn('mx-auto w-full', ancho)}>
        {migas.length > 0 && (
          <nav
            aria-label="Ruta de navegacion"
            className="mb-1 flex items-center gap-1 text-xs text-texto-3"
          >
            {migas.map((miga, i) => (
              <span key={`${miga.etiqueta}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden className="size-3" />}
                {miga.ruta ? (
                  <Link to={miga.ruta} className="rounded hover:text-texto-2 hover:underline">
                    {miga.etiqueta}
                  </Link>
                ) : (
                  <span>{miga.etiqueta}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-md">{titulo}</h1>
            {descripcion && <p className="mt-0.5 text-xs text-texto-2">{descripcion}</p>}
          </div>
          {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
        </div>

        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  )
}

export function Metrica({
  etiqueta,
  valor,
  tono,
  className,
}: {
  etiqueta: string
  valor: ReactNode
  tono?: 'neutro' | 'error' | 'riesgo' | 'ok' | undefined
  className?: string | undefined
}) {
  const tonos = {
    neutro: 'text-texto',
    error: 'text-[var(--error-fg)]',
    riesgo: 'text-[var(--riesgo-fg)]',
    ok: 'text-[var(--ok-fg)]',
  }
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-[11px] whitespace-nowrap text-texto-3">{etiqueta}</span>
      <span
        className={cn('text-md leading-tight font-semibold tabular-nums', tonos[tono ?? 'neutro'])}
      >
        {valor}
      </span>
    </div>
  )
}
