import { Link, type LinkProps } from 'react-router'
import { cn } from './utilidades'
import type { TamanoBoton, VarianteBoton } from './Boton'

const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    'bg-[var(--acento)] text-[var(--acento-texto)] hover:bg-[var(--acento-hover)] border border-transparent',
  secundario:
    'bg-superficie text-texto border border-borde hover:bg-superficie-2 hover:border-borde-fuerte',
  fantasma:
    'bg-transparent text-texto-2 border border-transparent hover:bg-superficie-2 hover:text-texto',
  peligro:
    'bg-transparent text-[var(--error-fg)] border border-borde hover:bg-[var(--error-bg)] hover:border-[var(--error-fg)]',
}

const TAMANOS: Record<TamanoBoton, string> = {
  md: 'h-8 px-3 text-sm gap-1.5',
  sm: 'h-7 px-2.5 text-xs gap-1',
}

/** Un enlace que se ve como boton. Navega de verdad (no es un onClick). */
export function EnlaceBoton({
  variante = 'secundario',
  tamano = 'md',
  className,
  children,
  ...resto
}: LinkProps & { variante?: VarianteBoton; tamano?: TamanoBoton }) {
  return (
    <Link
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded font-medium whitespace-nowrap',
        'transition-colors duration-100',
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...resto}
    >
      {children}
    </Link>
  )
}
