/** Generador con semilla fija: el seed produce siempre los mismos datos. */
export function crearAleatorio(semilla: number) {
  let estado = semilla >>> 0
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    siguiente,
    entero: (min: number, max: number) => Math.floor(siguiente() * (max - min + 1)) + min,
    decimal: (min: number, max: number) => siguiente() * (max - min) + min,
    elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)] as T,
    probabilidad: (p: number) => siguiente() < p,
    /** Indice elegido segun pesos relativos. */
    ponderado: (pesos: readonly number[]): number => {
      const total = pesos.reduce((a, b) => a + b, 0)
      let acumulado = siguiente() * total
      for (let i = 0; i < pesos.length; i += 1) {
        acumulado -= pesos[i] as number
        if (acumulado <= 0) return i
      }
      return pesos.length - 1
    },
  }
}

export type Aleatorio = ReturnType<typeof crearAleatorio>
