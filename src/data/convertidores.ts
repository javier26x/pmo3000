/**
 * Lectura tolerante de documentos de Firestore.
 *
 * Los normalizadores no usan Zod: en una tabla de 4.500 sitios un parse por
 * documento se nota. Zod se usa donde importa la correccion del dato (formularios
 * e importacion) y en la escritura, que son pocos documentos. En la lectura
 * preferimos ser tolerantes: un campo ausente toma su valor por defecto en vez
 * de romper la pantalla completa.
 */
import { Timestamp, type DocumentData, type FirestoreDataConverter } from 'firebase/firestore'
import { esFechaISO, type FechaISO } from '@/domain/fechas'

export const texto = (valor: unknown, porDefecto = ''): string =>
  typeof valor === 'string' ? valor : porDefecto

export const textoNulo = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor : null

export const numero = (valor: unknown, porDefecto = 0): number =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto

export const numeroNulo = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null

export const booleano = (valor: unknown, porDefecto = false): boolean =>
  typeof valor === 'boolean' ? valor : porDefecto

export const instante = (valor: unknown): Date | null => {
  if (valor instanceof Timestamp) return valor.toDate()
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  return null
}

export const fechaISO = (valor: unknown): FechaISO | null => (esFechaISO(valor) ? valor : null)

export function enumerado<T extends string>(
  valor: unknown,
  valores: readonly T[],
  porDefecto: T,
): T {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
    ? (valor as T)
    : porDefecto
}

export function enumeradoNulo<T extends string>(valor: unknown, valores: readonly T[]): T | null {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
    ? (valor as T)
    : null
}

export const listaTexto = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : []

export const objeto = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {}

/** Sellos de sistema comunes a todas las entidades. */
export function sellos(datos: DocumentData) {
  return {
    creadoEn: instante(datos.creadoEn),
    creadoPor: textoNulo(datos.creadoPor),
    actualizadoEn: instante(datos.actualizadoEn),
    actualizadoPor: textoNulo(datos.actualizadoPor),
  }
}

/**
 * Convertidor tipado. `toFirestore` quita el `id` porque en Firestore el id vive
 * en la ruta del documento, no en sus campos: duplicarlo invita a que se
 * desincronicen.
 */
export function crearConvertidor<T extends { id: string }>(
  normalizar: (id: string, datos: DocumentData) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore: (entidad) => {
      const { id: _id, ...resto } = entidad as T
      return resto as DocumentData
    },
    fromFirestore: (snap, opciones) => normalizar(snap.id, snap.data(opciones) ?? {}),
  }
}
