/**
 * Carpetas documentales de SharePoint.
 *
 * La app habla con una interfaz (ServicioCarpetas), no con SharePoint. Hoy la
 * implementa porCorreo: arma el correo con formato fijo que lee un flujo de
 * Power Automate (docs/power-automate-carpetas.md), porque crear carpetas con
 * Graph API exige Sites.ReadWrite.All y ese permiso necesita consentimiento de
 * administrador, que aun no esta.
 *
 * Migrar a Graph es escribir otra implementacion de ServicioCarpetas (que cree
 * la carpeta y devuelva { via: 'directa', url }) y cambiar crearServicioCarpetas
 * al final. La pantalla ya sabe manejar los dos resultados.
 */
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import {
  armarMailto,
  asuntoCarpeta,
  asuntoValido,
  cuerpoCarpeta,
  type DatosCarpeta,
} from '@/domain/carpetas'
import type { Actor } from '@/domain/tipos/comunes'

export interface SolicitudCarpeta {
  sitioId: string
  programaId: string
  datos: DatosCarpeta
}

/**
 * - correo: hay que enviar el correo (se abre el cliente con todo listo); la
 *   URL llega despues, en la respuesta del flujo, y se pega en la ficha.
 * - directa: la carpeta ya existe y esta es su URL (implementacion con Graph).
 */
export type ResultadoCarpeta = { via: 'correo'; mailto: string } | { via: 'directa'; url: string }

export interface ServicioCarpetas {
  /** Si esta lista para usarse; si no, por que (para mostrarlo en la pantalla). */
  disponible(): { ok: true } | { ok: false; motivo: string }
  solicitar(solicitud: SolicitudCarpeta, actor: Actor): Promise<ResultadoCarpeta>
}

export interface SolicitudRegistrada {
  id: string
  asunto: string
  generadoPor: string | null
  generadoEn: Date | null
}

/**
 * Solicitudes de carpeta de un sitio, la mas reciente primero. Se ordena en el
 * cliente: son pocas por sitio y asi no hace falta un indice compuesto.
 */
export function observarSolicitudesDeSitio(
  sitioId: string,
  cb: (lista: SolicitudRegistrada[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLECCIONES.solicitudesCarpeta), where('sitioId', '==', sitioId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => {
            const x = d.data()
            const en = x['generadoEn'] as { toDate?: () => Date } | null | undefined
            return {
              id: d.id,
              asunto: String(x['asunto'] ?? ''),
              generadoPor: typeof x['generadoPor'] === 'string' ? x['generadoPor'] : null,
              generadoEn: en?.toDate ? en.toDate() : null,
            }
          })
          .sort((a, b) => (b.generadoEn?.getTime() ?? 0) - (a.generadoEn?.getTime() ?? 0)),
      ),
    (e) => onError(e),
  )
}

/** Implementacion actual: correo a Power Automate. */
export function carpetasPorCorreo(config: {
  buzonCarpetas: string | null
  asuntoCarpeta: string
}): ServicioCarpetas {
  return {
    disponible: () =>
      config.buzonCarpetas
        ? { ok: true }
        : {
            ok: false,
            motivo:
              'Falta el buzón de Power Automate: un administrador lo configura en Configuración → Carpetas de SharePoint.',
          },

    async solicitar(solicitud, actor) {
      if (!config.buzonCarpetas) throw new Error('No hay buzón de Power Automate configurado')
      const asunto = asuntoCarpeta(config.asuntoCarpeta, solicitud.datos)
      if (!asuntoValido(asunto)) {
        throw new Error(
          'La plantilla del asunto no produce el formato que lee Power Automate (CREAR_CARPETA | programa | ID | nombre).',
        )
      }
      const cuerpo = cuerpoCarpeta(solicitud.datos)

      // Queda registro de que se pidio, cuando y quien: asi se ve que sitios
      // quedaron sin carpeta aunque el correo nunca se haya enviado.
      await addDoc(collection(db, COLECCIONES.solicitudesCarpeta), {
        sitioId: solicitud.sitioId,
        programaId: solicitud.programaId,
        asunto,
        cuerpo,
        via: 'correo',
        estado: 'preparada',
        generadoPor: actor.uid,
        generadoEn: serverTimestamp(),
        carpetaUrl: null,
      })

      return { via: 'correo', mailto: armarMailto(config.buzonCarpetas, asunto, cuerpo) }
    },
  }
}

/**
 * El servicio de carpetas que usa la app. Unico punto de cambio al migrar a
 * Graph: devolver aca la implementacion nueva (por ejemplo, segun una variable
 * de entorno) y nada fuera de src/data/microsoft cambia.
 */
export function crearServicioCarpetas(config: {
  buzonCarpetas: string | null
  asuntoCarpeta: string
}): ServicioCarpetas {
  return carpetasPorCorreo(config)
}
