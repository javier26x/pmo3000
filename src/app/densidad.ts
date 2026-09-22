import { create } from 'zustand'

export const DENSIDADES = ['compacta', 'normal', 'comoda'] as const
export type Densidad = (typeof DENSIDADES)[number]

export const NOMBRES_DENSIDAD: Record<Densidad, string> = {
  compacta: 'Compacta',
  normal: 'Normal',
  comoda: 'Cómoda',
}

const CLAVE = 'pmo3000.densidad'

function leer(): Densidad {
  try {
    const guardada = localStorage.getItem(CLAVE)
    if (guardada && (DENSIDADES as readonly string[]).includes(guardada))
      return guardada as Densidad
  } catch {
    // sin localStorage: densidad por defecto
  }
  return 'normal'
}

function aplicar(densidad: Densidad): void {
  // 'normal' no escribe el atributo: así el valor por defecto vive en el CSS.
  if (densidad === 'normal') delete document.documentElement.dataset.densidad
  else document.documentElement.dataset.densidad = densidad
  try {
    localStorage.setItem(CLAVE, densidad)
  } catch {
    // nada que persistir
  }
}

interface EstadoDensidad {
  densidad: Densidad
  fijar: (densidad: Densidad) => void
  siguiente: () => void
}

/**
 * Densidad de las tablas. Quien revisa 4.500 filas en un monitor grande quiere
 * ver la mayor cantidad posible; quien trabaja en terreno con el dedo necesita
 * filas más altas. Es la misma tabla con otro alto de fila.
 */
export const usarDensidad = create<EstadoDensidad>((set, get) => ({
  densidad: leer(),
  fijar: (densidad) => {
    aplicar(densidad)
    set({ densidad })
  },
  siguiente: () => {
    const actual = DENSIDADES.indexOf(get().densidad)
    const siguiente = DENSIDADES[(actual + 1) % DENSIDADES.length] ?? 'normal'
    aplicar(siguiente)
    set({ densidad: siguiente })
  },
}))

/** Se llama una vez al arrancar, antes del primer pintado de las tablas. */
export function aplicarDensidadGuardada(): void {
  aplicar(leer())
}
