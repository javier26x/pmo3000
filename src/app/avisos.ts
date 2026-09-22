import { create } from 'zustand'

export type TonoAviso = 'ok' | 'error' | 'info'

export interface AccionAviso {
  texto: string
  ejecutar: () => void
}

export interface AvisoActivo {
  id: number
  tono: TonoAviso
  texto: string
  accion?: AccionAviso
}

interface EstadoAvisos {
  avisos: AvisoActivo[]
  mostrar: (tono: TonoAviso, texto: string, accion?: AccionAviso) => number
  cerrar: (id: number) => void
}

let secuencia = 0

/** Un aviso con acción se queda más rato: hay que alcanzar a pulsarla. */
const DURACION_MS = { ok: 3500, info: 4500, conAccion: 8000 }

/**
 * Avisos efímeros. Los errores no se autocierran: si una escritura falló, la
 * persona tiene que poder leer el motivo completo y decidir qué hacer.
 */
export const usarAvisos = create<EstadoAvisos>((set, get) => ({
  avisos: [],
  mostrar: (tono, texto, accion) => {
    secuencia += 1
    const id = secuencia
    const aviso: AvisoActivo = { id, tono, texto, ...(accion ? { accion } : {}) }
    // Se topa la pila: cinco avisos apilados ya no los lee nadie.
    set((estado) => ({ avisos: [...estado.avisos, aviso].slice(-5) }))

    if (tono !== 'error') {
      const ms = accion ? DURACION_MS.conAccion : DURACION_MS[tono]
      setTimeout(() => get().cerrar(id), ms)
    }
    return id
  },
  cerrar: (id) => set((estado) => ({ avisos: estado.avisos.filter((a) => a.id !== id) })),
}))

export const avisar = {
  ok: (texto: string, accion?: AccionAviso) => usarAvisos.getState().mostrar('ok', texto, accion),
  error: (texto: string, accion?: AccionAviso) =>
    usarAvisos.getState().mostrar('error', texto, accion),
  info: (texto: string, accion?: AccionAviso) =>
    usarAvisos.getState().mostrar('info', texto, accion),
  cerrar: (id: number) => usarAvisos.getState().cerrar(id),
}

/** Traduce los errores técnicos de Firestore a algo accionable. */
export function mensajeDeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error)
  if (texto.includes('permission-denied') || texto.includes('PERMISSION_DENIED')) {
    return 'No tienes permiso para esta acción. Si crees que deberías tenerlo, pide a un administrador que revise tu rol.'
  }
  if (texto.includes('unavailable') || texto.includes('UNAVAILABLE')) {
    return 'Sin conexión con la base de datos. El cambio queda guardado en este dispositivo y se sincroniza al volver la señal.'
  }
  if (texto.includes('failed-precondition') && texto.includes('index')) {
    return 'Falta un índice en Firestore para esta consulta. Ejecuta: npm run deploy:rules'
  }
  return texto
}
