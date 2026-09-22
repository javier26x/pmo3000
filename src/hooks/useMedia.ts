import { useEffect, useState } from 'react'

/** Suscripcion a una media query, para decidir tabla vs tarjetas en terreno. */
export function useMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(consulta).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const alCambiar = () => setCoincide(mq.matches)
    alCambiar()
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [consulta])

  return coincide
}

export const useEsMovil = () => useMedia('(max-width: 767px)')
