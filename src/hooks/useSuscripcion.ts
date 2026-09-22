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

  // `cargando` se corrige en el MISMO render en que cambia `suscribir`, no en el
  // efecto. El efecto corre despues de pintar, asi que dejarlo ahi abria una
  // pasada con la suscripcion ya armada pero cargando en false y la lista
  // todavia vacia: justo la combinacion que las pantallas leen como "no hay
  // nada" y que hacia parpadear el estado vacio antes de los datos.
  //
  // Reajustar el estado durante el render al cambiar una entrada es el patron
  // que React documenta para esto; se re-ejecuta el componente al tiro y no se
  // pinta el cuadro intermedio.
  // Envuelto en un objeto: `suscribir` es una funcion, y useState trata una
  // funcion como inicializador perezoso (y setState como actualizador), asi que
  // guardarla pelada la ejecutaria en vez de almacenarla.
  const [suscritoA, setSuscritoA] = useState<{ fn: Suscriptor<T> | null }>({ fn: suscribir })
  if (suscribir !== suscritoA.fn) {
    setSuscritoA({ fn: suscribir })
    setCargando(suscribir !== null)
    // Los datos NO se limpian a proposito: al cambiar de filtro se sigue viendo
    // el resultado anterior hasta que llega el nuevo, en vez de un vacio.
  }

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
