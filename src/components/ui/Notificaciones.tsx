import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { usarAvisos } from '@/app/avisos'
import { cn } from './utilidades'

const ESTILOS = {
  ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  error: 'bg-[var(--error-bg)] text-[var(--error-fg)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
}

const ICONOS = {
  ok: CheckCircle2,
  error: XCircle,
  info: Info,
}

export function Notificaciones() {
  const avisos = usarAvisos((e) => e.avisos)
  const cerrar = usarAvisos((e) => e.cerrar)

  if (avisos.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96"
    >
      {avisos.map((aviso) => {
        const Icono = ICONOS[aviso.tono]
        return (
          <div
            key={aviso.id}
            role={aviso.tono === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm',
              'shadow-[var(--sombra-flotante)]',
              ESTILOS[aviso.tono],
            )}
          >
            <Icono aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1">{aviso.texto}</p>
            <button
              type="button"
              onClick={() => cerrar(aviso.id)}
              aria-label="Cerrar aviso"
              className="shrink-0 rounded opacity-70 hover:opacity-100"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
