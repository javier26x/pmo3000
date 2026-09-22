/**
 * config/app: ajustes de la instalacion que un admin cambia sin tocar codigo.
 * Por ahora, el buzon al que van las solicitudes de carpeta y la plantilla del
 * asunto que lee Power Automate.
 */
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { PLANTILLA_ASUNTO_POR_DEFECTO } from '@/domain/carpetas'
import type { Actor } from '@/domain/tipos/comunes'

export interface ConfigCarpetas {
  /** Buzon que lee el flujo de Power Automate. null: aun no configurado. */
  buzonCarpetas: string | null
  asuntoCarpeta: string
}

const refApp = () => doc(db, COLECCIONES.config, 'app')

export function observarConfigCarpetas(
  cb: (c: ConfigCarpetas) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    refApp(),
    (snap) => {
      const d = snap.data() ?? {}
      const buzon = typeof d['buzonCarpetas'] === 'string' ? d['buzonCarpetas'].trim() : ''
      const asunto = typeof d['asuntoCarpeta'] === 'string' ? d['asuntoCarpeta'].trim() : ''
      cb({
        buzonCarpetas: buzon || null,
        asuntoCarpeta: asunto || PLANTILLA_ASUNTO_POR_DEFECTO,
      })
    },
    (e) => onError(e),
  )
}

/** Solo admin (reglas de config). Con merge: config/app guarda otras cosas. */
export async function guardarConfigCarpetas(c: ConfigCarpetas, actor: Actor): Promise<void> {
  await setDoc(
    refApp(),
    {
      buzonCarpetas: c.buzonCarpetas,
      asuntoCarpeta: c.asuntoCarpeta,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )
}
