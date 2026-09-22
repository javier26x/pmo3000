import { create } from 'zustand'

export type Tema = 'claro' | 'oscuro'

const CLAVE = 'pmo3000.tema'

function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'claro' || guardado === 'oscuro') return guardado
  } catch {
    // sin localStorage (modo privado): se usa la preferencia del sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

function aplicar(tema: Tema): void {
  document.documentElement.dataset.tema = tema
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // nada que persistir
  }
}

interface EstadoTema {
  tema: Tema
  alternar: () => void
  fijar: (tema: Tema) => void
}

export const usarTema = create<EstadoTema>((set, get) => ({
  tema: leerTema(),
  alternar: () => {
    const siguiente: Tema = get().tema === 'claro' ? 'oscuro' : 'claro'
    aplicar(siguiente)
    set({ tema: siguiente })
  },
  fijar: (tema) => {
    aplicar(tema)
    set({ tema })
  },
}))
