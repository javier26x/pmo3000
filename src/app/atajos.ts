import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { usarTema } from './tema'
import { usarDensidad } from './densidad'

export interface Atajo {
  teclas: string[]
  descripcion: string
  grupo: string
}

/** Catálogo único: lo que se registra abajo es lo mismo que muestra la ayuda. */
export const ATAJOS: Atajo[] = [
  { grupo: 'General', teclas: ['⌘', 'K'], descripcion: 'Abrir la paleta de comandos' },
  { grupo: 'General', teclas: ['/'], descripcion: 'Buscar sitios en la vista actual' },
  { grupo: 'General', teclas: ['?'], descripcion: 'Mostrar esta ayuda' },
  { grupo: 'General', teclas: ['Esc'], descripcion: 'Cerrar el diálogo o limpiar la búsqueda' },

  { grupo: 'Ir a', teclas: ['G', 'S'], descripcion: 'Sitios' },
  { grupo: 'Ir a', teclas: ['G', 'M'], descripcion: 'Mapa' },
  { grupo: 'Ir a', teclas: ['G', 'K'], descripcion: 'Kanban' },
  { grupo: 'Ir a', teclas: ['G', 'I'], descripcion: 'Importar' },
  { grupo: 'Ir a', teclas: ['G', 'A'], descripcion: 'Auditoría' },
  { grupo: 'Ir a', teclas: ['G', 'U'], descripcion: 'Usuarios' },

  { grupo: 'Tabla', teclas: ['J', '↓'], descripcion: 'Bajar una fila' },
  { grupo: 'Tabla', teclas: ['K', '↑'], descripcion: 'Subir una fila' },
  { grupo: 'Tabla', teclas: ['Enter'], descripcion: 'Abrir la ficha de la fila' },

  { grupo: 'Apariencia', teclas: ['T'], descripcion: 'Alternar modo claro y oscuro' },
  { grupo: 'Apariencia', teclas: ['D'], descripcion: 'Cambiar la densidad de las tablas' },
]

const IR_A: Record<string, string> = {
  s: '/sitios',
  m: '/mapa',
  k: '/kanban',
  i: '/importar',
  a: '/auditoria',
  u: '/usuarios',
}

/** Tiempo para completar un acorde tipo `g` `s`. */
const VENTANA_ACORDE_MS = 1200

export function escribiendoEnCampo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return (
    destino.tagName === 'INPUT' ||
    destino.tagName === 'TEXTAREA' ||
    destino.tagName === 'SELECT' ||
    destino.isContentEditable
  )
}

/**
 * Atajos globales. Dos criterios: no secuestrar nunca una tecla mientras se
 * escribe en un campo, y no pisar los atajos del navegador (por eso los saltos
 * de pantalla son acordes `g`+letra y no letras sueltas).
 */
export function useAtajosGlobales(acciones: { abrirPaleta: () => void; abrirAyuda: () => void }) {
  const navegar = useNavigate()
  const alternarTema = usarTema((e) => e.alternar)
  const siguienteDensidad = usarDensidad((e) => e.siguiente)
  const acorde = useRef<{ tecla: string; en: number } | null>(null)
  const accionesRef = useRef(acciones)

  // Las acciones se guardan en una ref para que el listener no se vuelva a
  // registrar en cada render, pero la ref se actualiza en un efecto: escribirla
  // durante el render rompe las garantias de React.
  useEffect(() => {
    accionesRef.current = acciones
  })

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const esPaleta = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (esPaleta) {
        e.preventDefault()
        accionesRef.current.abrirPaleta()
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (escribiendoEnCampo(e.target)) return

      const tecla = e.key.toLowerCase()

      // Segunda tecla de un acorde `g` + destino.
      if (acorde.current && Date.now() - acorde.current.en < VENTANA_ACORDE_MS) {
        const destino = IR_A[tecla]
        acorde.current = null
        if (destino) {
          e.preventDefault()
          navegar(destino)
          return
        }
      }

      if (tecla === 'g') {
        acorde.current = { tecla, en: Date.now() }
        return
      }

      acorde.current = null

      if (e.key === '?') {
        e.preventDefault()
        accionesRef.current.abrirAyuda()
        return
      }
      if (tecla === 't') {
        e.preventDefault()
        alternarTema()
        return
      }
      if (tecla === 'd') {
        e.preventDefault()
        siguienteDensidad()
      }
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [navegar, alternarTema, siguienteDensidad])
}
