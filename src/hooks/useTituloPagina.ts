import { useEffect } from 'react'

const BASE = 'PMO3000'

/**
 * Título de la pestaña. Con varias pestañas abiertas —la tabla, un sitio, el
 * mapa— el título es lo único que las distingue.
 */
export function useTituloPagina(titulo: string | null): void {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${BASE}` : BASE
    return () => {
      document.title = BASE
    }
  }, [titulo])
}
