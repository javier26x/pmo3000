import { useEffect, useRef, useState } from 'react'
import { mensajeDeError } from '@/app/avisos'

export type Desuscribir = () => void
export type Suscriptor<T> = (cb: (datos: T) => void, onError: (e: Error) => void) => Desuscribir

export interface ResultadoSuscripcion<T> {
  datos: T
  cargando: boolean
  error: string | null
}

/**
 * Puente entre onSnapshot y React. Firestore ya es tiempo real, asi que no hay
 * capa de cache encima: el snapshot ES el estado.
 *
 * `suscribir` tiene que venir memoizado con useCallback; si cambia en cada
 * render, la suscripcion se rearma sin parar.
 */
export function useSuscripcion<T>(
  suscribir: Suscriptor<T> | null,
  inicial: T,
): ResultadoSuscripcion<T> {
  const [datos, setDatos] = useState<T>(inicial)
  const [cargando, setCargando] = useState(suscribir !== null)
  const [error, setError] = useState<string | null>(null)
  const inicialRef = useRef(inicial)

  useEffect(() => {
    if (!suscribir) {
      setDatos(inicialRef.current)
      setCargando(false)
      setError(null)
      return
    }

    let vivo = true
    setCargando(true)
    setError(null)

    const cancelar = suscribir(
      (nuevos) => {
        if (!vivo) return
        setDatos(nuevos)
        setCargando(false)
      },
      (e) => {
        if (!vivo) return
        setError(mensajeDeError(e))
        setCargando(false)
      },
    )

    return () => {
      vivo = false
      cancelar()
    }
  }, [suscribir])

  return { datos, cargando, error }
}
