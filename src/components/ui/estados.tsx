import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './utilidades'

export function Cargando({
  texto = 'Cargando…',
  className,
}: {
  texto?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 p-6 text-sm text-texto-2', className)}
    >
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {texto}
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-superficie-3', className)} />
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  accion,
}: {
  titulo: string
  descripcion?: string | undefined
  icono?: ReactNode | undefined
  accion?: ReactNode | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icono && <div className="text-texto-3">{icono}</div>}
      <p className="text-md font-medium">{titulo}</p>
      {descripcion && <p className="max-w-md text-sm text-texto-2">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}

export function Aviso({
  tono = 'info',
  titulo,
  children,
  className,
}: {
  tono?: 'info' | 'ok' | 'riesgo' | 'error'
  titulo?: string | undefined
  children: ReactNode
  className?: string | undefined
}) {
  const tonos = {
    info: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
    ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
    riesgo: 'bg-[var(--riesgo-bg)] text-[var(--riesgo-fg)]',
    error: 'bg-[var(--error-bg)] text-[var(--error-fg)]',
  }
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={cn('rounded px-3 py-2 text-sm', tonos[tono], className)}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? 'mt-0.5' : undefined}>{children}</div>
    </div>
  )
}

export function BarraProgreso({
  valor,
  etiqueta,
  className,
}: {
  valor: number
  etiqueta?: string
  className?: string
}) {
  const acotado = Math.max(0, Math.min(100, Math.round(valor)))
  return (
    <div
      role="progressbar"
      aria-valuenow={acotado}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta ?? `${acotado}% de avance`}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-superficie-3', className)}
    >
      <div
        className="h-full rounded-full bg-[var(--acento)] transition-[width] duration-200"
        style={{ width: `${acotado}%` }}
      />
    </div>
  )
}
