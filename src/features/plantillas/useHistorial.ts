import { useCallback, useRef, useState } from 'react'

/** Cuanto tiempo se agrupan los cambios seguidos de un mismo campo. */
const AGRUPAR_MS = 1000

interface Estado<T> {
  pasado: T[]
  presente: T
  futuro: T[]
}

/**
 * Un valor con deshacer y rehacer.
 *
 * `cambiar` recibe una `clave` opcional: los cambios seguidos con la misma
 * clave (escribir en un campo, letra por letra) se juntan en un solo paso, asi
 * "Deshacer" vuelve a como estaba el campo antes de empezar a escribir y no
 * borra una letra por vez.
 */
export function useHistorial<T>(inicial: () => T) {
  const [estado, setEstado] = useState<Estado<T>>(() => ({
    pasado: [],
    presente: inicial(),
    futuro: [],
  }))
  const ultimo = useRef<{ clave: string; en: number } | null>(null)

  const cambiar = useCallback((actualizar: (actual: T) => T, clave?: string) => {
    const ahora = Date.now()
    const previo = ultimo.current
    const agrupar = clave !== undefined && previo?.clave === clave && ahora - previo.en < AGRUPAR_MS
    ultimo.current = clave === undefined ? null : { clave, en: ahora }
    setEstado((e) => {
      const siguiente = actualizar(e.presente)
      if (siguiente === e.presente) return e
      return {
        pasado: agrupar ? e.pasado : [...e.pasado, e.presente],
        presente: siguiente,
        futuro: [],
      }
    })
  }, [])

  const deshacer = useCallback(() => {
    ultimo.current = null
    setEstado((e) => {
      const anterior = e.pasado.at(-1)
      if (anterior === undefined) return e
      return {
        pasado: e.pasado.slice(0, -1),
        presente: anterior,
        futuro: [e.presente, ...e.futuro],
      }
    })
  }, [])

  const rehacer = useCallback(() => {
    ultimo.current = null
    setEstado((e) => {
      const [siguiente, ...resto] = e.futuro
      if (siguiente === undefined) return e
      return { pasado: [...e.pasado, e.presente], presente: siguiente, futuro: resto }
    })
  }, [])

  /** Vuelve a `valor` como punto de partida, sin historial. */
  const reiniciar = useCallback((valor: T) => {
    ultimo.current = null
    setEstado({ pasado: [], presente: valor, futuro: [] })
  }, [])

  return {
    valor: estado.presente,
    cambiar,
    deshacer,
    rehacer,
    reiniciar,
    puedeDeshacer: estado.pasado.length > 0,
    puedeRehacer: estado.futuro.length > 0,
  }
}
