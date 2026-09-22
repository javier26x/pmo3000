import { create } from 'zustand'

export type TonoAviso = 'ok' | 'error' | 'info'

export interface AvisoActivo {
  id: number
  tono: TonoAviso
  texto: string
}

interface EstadoAvisos {
  avisos: AvisoActivo[]
  mostrar: (tono: TonoAviso, texto: string) => void
  cerrar: (id: number) => void
}

let secuencia = 0

/**
 * Avisos efimeros. Los errores no se autocierran: si una escritura fallo, la
 * persona tiene que poder leer el motivo completo.
 */
export const usarAvisos = create<EstadoAvisos>((set, get) => ({
  avisos: [],
  mostrar: (tono, texto) => {
    secuencia += 1
    const id = secuencia
    set((estado) => ({ avisos: [...estado.avisos, { id, tono, texto }] }))
    if (tono !== 'error') {
      setTimeout(() => get().cerrar(id), 4000)
    }
  },
  cerrar: (id) => set((estado) => ({ avisos: estado.avisos.filter((a) => a.id !== id) })),
}))

export const avisar = {
  ok: (texto: string) => usarAvisos.getState().mostrar('ok', texto),
  error: (texto: string) => usarAvisos.getState().mostrar('error', texto),
  info: (texto: string) => usarAvisos.getState().mostrar('info', texto),
}

/** Traduce los errores tecnicos de Firestore a algo accionable. */
export function mensajeDeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error)
  if (texto.includes('permission-denied') || texto.includes('PERMISSION_DENIED')) {
    return 'No tienes permiso para esta accion. Si crees que deberias tenerlo, pide a un administrador que revise tu rol.'
  }
  if (texto.includes('unavailable') || texto.includes('UNAVAILABLE')) {
    return 'No hay conexion con la base de datos. Revisa tu red o si los emuladores estan levantados.'
  }
  if (texto.includes('failed-precondition') && texto.includes('index')) {
    return 'Falta un indice en Firestore para esta consulta. Ejecuta: npm run deploy:rules'
  }
  return texto
}
