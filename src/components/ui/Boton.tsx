import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './utilidades'

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro'
export type TamanoBoton = 'sm' | 'md'

/** Compartidas con EnlaceBoton: un enlace con forma de boton se ve igual. */
export const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    'boton-gota bg-[var(--acento)] text-[var(--acento-texto)] hover:bg-[var(--acento-hover)] border border-transparent',
  secundario:
    'bg-superficie/80 text-texto border border-borde hover:bg-superficie-2 hover:border-borde-fuerte',
  fantasma:
    'bg-transparent text-texto-2 border border-transparent hover:bg-superficie-2 hover:text-texto',
  peligro:
    'bg-transparent text-[var(--error-fg)] border border-borde hover:bg-[var(--error-bg)] hover:border-[var(--error-fg)]',
}

export const TAMANOS: Record<TamanoBoton, string> = {
  // 32px y 28px de alto: compacto, pero con area tactil suficiente en celular
  // gracias al padding horizontal.
  md: 'h-8 px-3 text-sm gap-1.5',
  sm: 'h-7 px-2.5 text-xs gap-1',
}

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  cargando?: boolean
  icono?: ReactNode
  soloIcono?: boolean
}

export const Boton = forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  {
    variante = 'secundario',
    tamano = 'md',
    cargando = false,
    icono,
    soloIcono = false,
    className,
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap',
        'transition-colors duration-100',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTES[variante],
        TAMANOS[tamano],
        soloIcono && (tamano === 'sm' ? 'w-7 px-0' : 'w-8 px-0'),
        className,
      )}
      {...resto}
    >
      {cargando ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : icono}
      {!soloIcono && children}
    </button>
  )
})
