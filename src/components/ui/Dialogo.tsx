import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Boton } from './Boton'
import { cn } from './utilidades'

/**
 * Se usa el elemento <dialog> nativo: entrega gratis la trampa de foco, el
 * cierre con Escape y el fondo inerte, que hechos a mano siempre quedan a medias.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
  ancho = 'md',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string | undefined
  children: ReactNode
  pie?: ReactNode | undefined
  /** `completo` es para editores de trabajo largo: casi toda la pantalla. */
  ancho?: 'sm' | 'md' | 'lg' | 'xl' | 'completo'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  // Donde empezo el clic: un arrastre que empieza en un campo y se suelta
  // sobre el fondo (al seleccionar texto) dispara un click en el <dialog>, y
  // cerrar ahi botaria lo escrito.
  const presionEnFondo = useRef(false)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  useEffect(() => {
    const dialogo = ref.current
    // Si el componente se desmonta con el diálogo abierto, el navegador lo deja
    // colgado en la capa superior: la página queda inerte y el siguiente
    // showModal() no hace nada. Cerrarlo al desmontar evita ese estado zombi.
    return () => {
      if (dialogo?.open) dialogo.close()
    }
  }, [])

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    const alCancelar = (e: Event) => {
      e.preventDefault()
      onCerrar()
    }
    dialogo.addEventListener('cancel', alCancelar)
    return () => dialogo.removeEventListener('cancel', alCancelar)
  }, [onCerrar])

  const anchos = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
    completo: 'max-w-7xl',
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      className={cn(
        'm-auto w-[calc(100vw-1.5rem)] rounded-lg border p-0 text-texto',
        'vidrio-denso vidrio-alzado',
        anchos[ancho],
      )}
      onMouseDown={(e) => {
        presionEnFondo.current = e.target === ref.current
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra, solo si tambien empezo ahi.
        if (e.target === ref.current && presionEnFondo.current) onCerrar()
        presionEnFondo.current = false
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-borde px-4 py-3">
        <div className="min-w-0">
          <h2 id={idTitulo} className="text-md">
            {titulo}
          </h2>
          {descripcion && <p className="mt-0.5 text-xs text-texto-2">{descripcion}</p>}
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          onClick={onCerrar}
          aria-label="Cerrar"
          icono={<X aria-hidden className="size-4" />}
        />
      </div>

      <div
        className={cn(
          // relative: lo absoluto de adentro (etiquetas sr-only, radios ocultos)
          // se queda en esta caja que se desplaza. Sin esto se posiciona contra
          // el <dialog> y lo estira, y el dialogo entero se corre al usar Espacio.
          'panel-scroll relative overflow-y-auto px-4 py-3',
          ancho === 'completo' ? 'max-h-[calc(100dvh-11rem)]' : 'max-h-[70vh]',
        )}
      >
        {children}
      </div>

      {pie && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde bg-superficie-2 px-4 py-3">
          {pie}
        </div>
      )}
    </dialog>
  )
}
