import { useEffect, useMemo, useState } from 'react'
import { mensajeDeError } from '@/app/avisos'

export type Desuscribir = () => void
export type Suscriptor<T> = (cb: (datos: T) => void, onError: (e: Error) => void) => Desuscribir

export interface ResultadoSuscripcion<T> {
  datos: T
  cargando: boolean
  error: string | null
}

interface Estado<T> {
  /** Suscriptor que produjo `datos` o `error`: si no es el actual, se esta cargando. */
  fuente: Suscriptor<T> | null
  datos: T
  error: string | null
}

/**
 * Puente entre onSnapshot y React. Firestore ya es tiempo real, asi que no hay
 * capa de cache encima: el snapshot ES el estado.
 *
 * `suscribir` tiene que venir memoizado con useCallback; si cambia en cada
 * render, la suscripcion se rearma sin parar.
 *
 * "Cargando" se deduce de si la ultima respuesta vino del suscriptor actual, no
 * de una bandera que un efecto prende despues: asi el mismo render en que llega
 * un suscriptor nuevo ya dice que esta cargando (antes decia "listo" con los
 * datos del anterior). Mientras carga se conservan los datos anteriores.
 *
 * El resultado es un objeto estable mientras no cambie nada, asi que sirve como
 * dependencia de un useMemo sin forzarlo a recalcular en cada render.
 */
export function useSuscripcion<T>(
  suscribir: Suscriptor<T> | null,
  inicial: T,
): ResultadoSuscripcion<T> {
  const [estado, setEstado] = useState<Estado<T>>({ fuente: null, datos: inicial, error: null })

  useEffect(() => {
    if (!suscribir) return
    let vivo = true
    const cancelar = suscribir(
      (datos) => {
        if (vivo) setEstado({ fuente: suscribir, datos, error: null })
      },
      (e) => {
        if (vivo) setEstado((previo) => ({ ...previo, fuente: suscribir, error: mensajeDeError(e) }))
      },
    )
    return () => {
      vivo = false
      cancelar()
    }
  }, [suscribir])

  const apagado = suscribir === null
  const datos = apagado ? inicial : estado.datos
  const cargando = !apagado && estado.fuente !== suscribir
  const error = apagado || cargando ? null : estado.error
  return useMemo(() => ({ datos, cargando, error }), [datos, cargando, error])
}
