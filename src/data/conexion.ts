/**
 * Estado de la conexion con Firestore.
 *
 * No basta con `navigator.onLine`: el dispositivo puede tener wifi y no alcanzar
 * el backend. La senal fiable son los metadatos del snapshot: `fromCache` en
 * true significa que Firestore esta sirviendo desde el disco porque no logra
 * hablar con el servidor.
 */
import { doc, onSnapshot } from 'firebase/firestore'
import { COLECCIONES, db } from './firebase'

export type EstadoConexion = 'conectado' | 'sin_conexion' | 'sincronizando'

export interface InformeConexion {
  estado: EstadoConexion
  /** Hay escrituras hechas sin conexion esperando subir. */
  cambiosPendientes: boolean
}

/** Margen antes de declarar la caida: evita parpadeos en microcortes. */
const ESPERA_MS = 2500

export function observarConexion(cb: (informe: InformeConexion) => void): () => void {
  let desdeCache = false
  let pendientes = false
  let enLinea = typeof navigator === 'undefined' ? true : navigator.onLine
  let temporizador: ReturnType<typeof setTimeout> | null = null
  let ultimo: InformeConexion = { estado: 'conectado', cambiosPendientes: false }

  const emitir = () => {
    const estado: EstadoConexion =
      !enLinea || desdeCache ? 'sin_conexion' : pendientes ? 'sincronizando' : 'conectado'

    if (estado === ultimo.estado && pendientes === ultimo.cambiosPendientes) return
    ultimo = { estado, cambiosPendientes: pendientes }
    cb(ultimo)
  }

  const programar = () => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(emitir, ESPERA_MS)
  }

  // Un solo documento, con metadatos: el costo es una lectura y queda cacheada.
  const cancelar = onSnapshot(
    doc(db, COLECCIONES.config, 'app'),
    { includeMetadataChanges: true },
    (snap) => {
      desdeCache = snap.metadata.fromCache
      pendientes = snap.metadata.hasPendingWrites
      if (desdeCache) programar()
      else {
        if (temporizador) clearTimeout(temporizador)
        emitir()
      }
    },
    () => {
      desdeCache = true
      programar()
    },
  )

  const alConectar = () => {
    enLinea = true
    emitir()
  }
  const alDesconectar = () => {
    enLinea = false
    emitir()
  }

  window.addEventListener('online', alConectar)
  window.addEventListener('offline', alDesconectar)

  return () => {
    if (temporizador) clearTimeout(temporizador)
    window.removeEventListener('online', alConectar)
    window.removeEventListener('offline', alDesconectar)
    cancelar()
  }
}
