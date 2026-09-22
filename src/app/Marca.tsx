import { useState } from 'react'
import { Radio } from 'lucide-react'
import { cn } from '@/components/ui'

/**
 * Logo oficial de Claro, si la instalacion lo trae: se deja el archivo en
 * public/marca/claro.svg (lo entrega el area de marca; no se redibuja a mano).
 * Mientras no este, se muestra el isotipo de PMO3000 en rojo Claro.
 */
const LOGO_OFICIAL = '/marca/claro.svg'

export function Marca({ tamano = 'md' }: { tamano?: 'md' | 'lg' }) {
  const [sinLogo, setSinLogo] = useState(false)
  const alto = tamano === 'lg' ? 'h-8' : 'h-6'

  return (
    <span className="flex items-center gap-2">
      {sinLogo ? (
        <span
          aria-hidden
          className={cn(
            'grid place-items-center rounded-lg bg-[var(--acento)] text-[var(--acento-texto)]',
            tamano === 'lg' ? 'size-9' : 'size-7',
          )}
        >
          <Radio className={tamano === 'lg' ? 'size-5' : 'size-4'} />
        </span>
      ) : (
        <img
          src={LOGO_OFICIAL}
          alt="Claro"
          className={cn(alto, 'w-auto')}
          onError={() => setSinLogo(true)}
        />
      )}
      <span className="flex flex-col leading-none">
        <span
          className={cn('font-semibold tracking-tight', tamano === 'lg' ? 'text-xl' : 'text-sm')}
        >
          PMO<span className="text-[var(--acento)]">3000</span>
        </span>
        <span className="mt-0.5 text-[10px] tracking-wide text-texto-3 uppercase">
          Claro Chile · Despliegue
        </span>
      </span>
    </span>
  )
}
