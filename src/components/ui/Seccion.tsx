import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './utilidades'

const PREFIJO = 'pmo3000.seccion.'

function leer(id: string, porDefecto: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIJO + id)
    return v === null ? porDefecto : v === '1'
  } catch {
    return porDefecto
  }
}

function guardar(id: string, abierta: boolean): void {
  try {
    localStorage.setItem(PREFIJO + id, abierta ? '1' : '0')
  } catch {
    // Sin almacenamiento vuelve a su estado por defecto la proxima vez.
  }
}

/**
 * Panel con cabecera que se pliega. Recuerda, por `id`, como lo dejo la
 * persona. Plegado NO monta su contenido: una ficha con siete bloques cerrados
 * cuesta lo que cuestan siete cabeceras, que es la idea de plegarlos.
 *
 * La accion va fuera del boton de la cabecera: un clic en "Editar" no pliega.
 */
export function Seccion({
  id,
  icono,
  titulo,
  descripcion,
  resumen,
  accion,
  abiertaPorDefecto = true,
  className,
  children,
}: {
  /** Clave para recordar si esta abierta. Sin ella, no se recuerda. */
  id?: string | undefined
  icono?: ReactNode
  titulo: string
  descripcion?: ReactNode | undefined
  /** Lo que se ve junto al titulo cuando esta plegada (un conteo, un estado). */
  resumen?: ReactNode | undefined
  accion?: ReactNode | undefined
  abiertaPorDefecto?: boolean
  className?: string | undefined
  children: ReactNode
}) {
  const [abierta, setAbierta] = useState(() =>
    id ? leer(id, abiertaPorDefecto) : abiertaPorDefecto,
  )
  const idCuerpo = useId()
  const alternar = () =>
    setAbierta((v) => {
      if (id) guardar(id, !v)
      return !v
    })

  return (
    <section aria-label={titulo} className={cn('seccion rounded-[var(--radio-xl)]', className)}>
      <header className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierta}
          aria-controls={idCuerpo}
          className="group flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[var(--radio-xl)] py-2.5 pl-4 text-left"
        >
          {icono && (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-superficie-2 text-texto-2 group-hover:text-[var(--acento)]">
              {icono}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold">{titulo}</span>
              {!abierta && resumen && (
                <span className="text-xs text-texto-3 tabular-nums">{resumen}</span>
              )}
            </span>
            {abierta && descripcion && (
              <span className="mt-0.5 block text-xs text-texto-2">{descripcion}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-texto-3 transition-transform duration-[var(--ms-rapido)]',
              !abierta && '-rotate-90',
            )}
          />
        </button>
        {abierta && accion}
      </header>
      {abierta && (
        <div id={idCuerpo} className="border-t border-[var(--vidrio-divisor)] p-4">
          {children}
        </div>
      )}
    </section>
  )
}
