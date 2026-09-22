import type { ReactNode } from 'react'
import { cn } from './utilidades'

export type TonoInsignia = 'neutro' | 'ok' | 'riesgo' | 'error' | 'info' | 'acento'

const TONOS: Record<TonoInsignia, string> = {
  neutro: 'bg-superficie-3 text-texto-2',
  ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  riesgo: 'bg-[var(--riesgo-bg)] text-[var(--riesgo-fg)]',
  error: 'bg-[var(--error-bg)] text-[var(--error-fg)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  acento: 'bg-[var(--acento-suave)] text-[var(--acento)]',
}

export function Insignia({
  tono = 'neutro',
  children,
  className,
  title,
}: {
  tono?: TonoInsignia
  children: ReactNode
  className?: string | undefined
  title?: string | undefined
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}
