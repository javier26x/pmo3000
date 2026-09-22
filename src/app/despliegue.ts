import { create } from 'zustand'

interface EstadoPausa {
  pausado: boolean
  pausar: () => void
  reanudar: () => void
}

/**
 * Permite soltar las suscripciones en vivo al maestro y al seguimiento.
 *
 * Existe por un problema medido: al importar miles de sitios, cada lote
 * confirmado empuja miles de documentos por los listeners abiertos y el
 * navegador se queda pegado recalculando tablas que nadie esta mirando. La
 * pantalla de importacion no necesita esas listas, asi que las suelta mientras
 * escribe y las retoma al salir.
 */
export const usarPausaDespliegue = create<EstadoPausa>((set) => ({
  pausado: false,
  pausar: () => set({ pausado: true }),
  reanudar: () => set({ pausado: false }),
}))
