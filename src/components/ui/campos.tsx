import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from './utilidades'

const BASE_CONTROL = cn(
  'w-full rounded border border-borde bg-superficie px-2 text-sm text-texto',
  'placeholder:text-texto-3',
  'hover:border-borde-fuerte focus:border-[var(--acento)] focus:outline-none',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--acento)]',
  'disabled:cursor-not-allowed disabled:bg-superficie-2 disabled:text-texto-3',
)

export function Campo({
  etiqueta,
  ayuda,
  error,
  obligatorio,
  children,
  htmlFor,
  className,
}: {
  etiqueta: string
  ayuda?: string | undefined
  error?: string | undefined
  obligatorio?: boolean
  children: ReactNode
  htmlFor?: string | undefined
  className?: string | undefined
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-texto-2">
        {etiqueta}
        {obligatorio && (
          <span aria-hidden className="ml-0.5 text-[var(--error-fg)]">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[var(--error-fg)]">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-texto-3">{ayuda}</p>
      ) : null}
    </div>
  )
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Entrada({ className, ...resto }, ref) {
    return <input ref={ref} className={cn(BASE_CONTROL, 'h-8', className)} {...resto} />
  },
)

export const AreaTexto = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaTexto({ className, rows = 3, ...resto }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn(BASE_CONTROL, 'py-1.5', className)} {...resto} />
  )
})

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Selector({ className, children, ...resto }, ref) {
    return (
      <select
        ref={ref}
        className={cn(BASE_CONTROL, 'h-8 cursor-pointer pr-6', className)}
        {...resto}
      >
        {children}
      </select>
    )
  },
)

export function Casilla({
  etiqueta,
  descripcion,
  className,
  id,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode; descripcion?: string }) {
  const idGenerado = useId()
  const idFinal = id ?? idGenerado
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <input
        id={idFinal}
        type="checkbox"
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer rounded border-borde-fuerte',
          'accent-[var(--acento)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...resto}
      />
      <div className="min-w-0">
        <label htmlFor={idFinal} className="cursor-pointer text-sm text-texto">
          {etiqueta}
        </label>
        {descripcion && <p className="text-xs text-texto-3">{descripcion}</p>}
      </div>
    </div>
  )
}
