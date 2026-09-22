import { Link, type LinkProps } from 'react-router'
import { cn } from './utilidades'
import { TAMANOS, VARIANTES, type TamanoBoton, type VarianteBoton } from './Boton'

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
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap',
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
