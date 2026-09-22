import { CloudOff, RefreshCw } from 'lucide-react'
import { cn } from '@/components/ui'
import { useConexion } from '@/hooks/useConexion'

/**
 * Estado de la conexión. Solo aparece cuando hay algo que decir: en terreno la
 * señal se cae, y lo que la persona necesita saber es que puede seguir
 * trabajando y que nada se va a perder.
 */
export function IndicadorConexion() {
  const { estado } = useConexion()

  if (estado === 'conectado') return null

  const sinConexion = estado === 'sin_conexion'

  return (
    <span
      role="status"
      title={
        sinConexion
          ? 'Sin conexión. Lo que edites se guarda en este dispositivo y se sincroniza solo al volver la señal.'
          : 'Subiendo los cambios hechos sin conexión.'
      }
      className={cn(
        'anim-aparecer flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium',
        sinConexion
          ? 'bg-[var(--riesgo-bg)] text-[var(--riesgo-fg)]'
          : 'bg-[var(--info-bg)] text-[var(--info-fg)]',
      )}
    >
      {sinConexion ? (
        <CloudOff aria-hidden className="size-3.5" />
      ) : (
        <RefreshCw aria-hidden className="size-3.5 animate-spin" />
      )}
      <span className="hidden sm:inline">{sinConexion ? 'Sin conexión' : 'Sincronizando'}</span>
    </span>
  )
}
