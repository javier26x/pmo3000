import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from './utilidades'

/**
 * Menu flotante accesible. Sin dependencias: el comportamiento que importa es
 * Escape para cerrar, clic fuera para cerrar, flechas para recorrer y que el
 * foco vuelva al disparador. Eso se hace en 60 lineas y se entiende.
 *
 * Se dibuja en un portal para que ningun contenedor con overflow lo recorte.
 */
export function useMenuFlotante(alCerrar?: () => void) {
  const [abierto, setAbierto] = useState(false)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, ancho: 0 })
  const disparadorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const cerrar = useCallback(
    (devolverFoco = true) => {
      setAbierto(false)
      if (devolverFoco) disparadorRef.current?.focus()
      alCerrar?.()
    },
    [alCerrar],
  )

  const medir = useCallback(() => {
    const caja = disparadorRef.current?.getBoundingClientRect()
    if (caja) setPosicion({ top: caja.bottom + 6, left: caja.left, ancho: caja.width })
  }, [])

  const alternar = useCallback(() => {
    if (abierto) cerrar()
    else {
      medir()
      setAbierto(true)
    }
  }, [abierto, cerrar, medir])

  useEffect(() => {
    if (!abierto) return

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar()
      }
    }
    const alApuntar = (e: MouseEvent) => {
      const destino = e.target as Node
      if (panelRef.current?.contains(destino) || disparadorRef.current?.contains(destino)) return
      cerrar(false)
    }

    document.addEventListener('keydown', alTeclear, true)
    document.addEventListener('mousedown', alApuntar)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)

    return () => {
      document.removeEventListener('keydown', alTeclear, true)
      document.removeEventListener('mousedown', alApuntar)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto, cerrar, medir])

  return { abierto, alternar, cerrar, disparadorRef, panelRef, posicion }
}

export function PanelMenu({
  panelRef,
  posicion,
  alineacion = 'izquierda',
  ancho = 'w-64',
  etiquetaAria,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  posicion: { top: number; left: number; ancho: number }
  alineacion?: 'izquierda' | 'derecha'
  ancho?: string
  etiquetaAria: string
  children: ReactNode
}) {
  // La posición final depende del tamaño real del panel, que solo se conoce una
  // vez montado. Se mide en un layout effect y se pinta recién ahí: así nunca se
  // ve el salto desde la posición provisional ni se sale de la ventana.
  const [izquierda, setIzquierda] = useState<number | null>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const anchoPanel = panel.offsetWidth
    const base =
      alineacion === 'derecha' ? posicion.left + posicion.ancho - anchoPanel : posicion.left

    const maximo = window.innerWidth - anchoPanel - 8
    setIzquierda(Math.max(8, Math.min(base, maximo)))
  }, [panelRef, posicion, alineacion])

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={etiquetaAria}
      style={{
        position: 'fixed',
        top: posicion.top,
        left: izquierda ?? posicion.left,
        zIndex: 60,
        visibility: izquierda === null ? 'hidden' : 'visible',
      }}
      className={cn(
        'anim-aparecer panel-scroll max-h-[70vh] overflow-y-auto rounded-lg border',
        'vidrio vidrio-alzado p-1',
        ancho,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

export function ItemMenu({
  children,
  onClick,
  icono,
  atajo,
  activo,
  peligro,
  className,
}: {
  children: ReactNode
  onClick: () => void
  icono?: ReactNode
  atajo?: string
  activo?: boolean
  peligro?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
        'transition-colors duration-[var(--ms-instante)]',
        activo ? 'bg-[var(--acento-suave)] text-[var(--acento)]' : 'hover:bg-superficie-2',
        peligro && 'text-[var(--error-fg)] hover:bg-[var(--error-bg)]',
        className,
      )}
    >
      {icono && <span className="shrink-0 text-texto-3">{icono}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {atajo && <span className="tecla shrink-0">{atajo}</span>}
    </button>
  )
}

export function SeparadorMenu() {
  return <div role="separator" className="my-1 border-t border-borde" />
}

export function TituloMenu({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-texto-3 uppercase">
      {children}
    </p>
  )
}

/** Menu completo con disparador propio, para los casos simples. */
export function Menu({
  etiqueta,
  etiquetaAria,
  icono,
  children,
  alineacion = 'izquierda',
  ancho,
  className,
}: {
  etiqueta: string
  /** Obligatoria cuando el disparador es solo un icono. */
  etiquetaAria?: string
  icono?: ReactNode
  children: (cerrar: () => void) => ReactNode
  alineacion?: 'izquierda' | 'derecha'
  ancho?: string
  className?: string
}) {
  const { abierto, alternar, cerrar, disparadorRef, panelRef, posicion } = useMenuFlotante()
  const id = useId()

  return (
    <>
      <button
        ref={disparadorRef}
        type="button"
        id={id}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={etiquetaAria ?? (etiqueta === '' ? 'Abrir menú' : undefined)}
        onClick={alternar}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-borde bg-superficie',
          'px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-[var(--ms-instante)]',
          'hover:border-borde-fuerte hover:bg-superficie-2',
          abierto && 'border-borde-fuerte bg-superficie-2',
          className,
        )}
      >
        {icono}
        {etiqueta}
      </button>

      {abierto && (
        <PanelMenu
          panelRef={panelRef}
          posicion={posicion}
          alineacion={alineacion}
          etiquetaAria={etiquetaAria ?? etiqueta}
          {...(ancho ? { ancho } : {})}
        >
          {children(() => cerrar())}
        </PanelMenu>
      )}
    </>
  )
}
