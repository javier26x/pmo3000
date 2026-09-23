/**
 * Perfiles de tracker: formatos conocidos que no se pueden deducir.
 *
 * La inferencia (inferencia.ts) arma el proceso con las columnas "Status X", y
 * con eso lee los trackers de despliegue. Hay planillas que no tienen esas
 * columnas: el control de RWK anota cada paso en una columna propia ("Desarme",
 * "RFI PMO", "Baja de sitio-NOC") con una fecha, un "OK", un "Pendiente" o un
 * "-". De ahi no sale ni que columnas son pasos ni como se agrupan, porque eso
 * lo sabe la PMO y no el archivo.
 *
 * Un perfil lo declara: con que encabezados se reconoce el formato, que etapas
 * tiene y que columna es cada paso (un "hito"). Solo se aplica cuando el archivo
 * no trae columnas "Status": un tracker de despliegue nunca cae aca.
 */
import type { TipoEtapa } from '@/domain/gates/catalogo'
import { parsearFechaFlexible, type FechaISO } from '@/domain/fechas'
import { clasificarEstado, esFechaDeEstado, normalizarTexto } from './estados'

/**
 * Como se ubica una columna. Los encabezados se repiten ("Fecha" tres veces en
 * el bloque HW, "Estatus" al principio y al final), asi que se puede pedir la
 * primera que aparece DESPUES de otra.
 */
export interface UbicacionColumna {
  encabezado: string
  tras?: string
  /** Basta con que el encabezado empiece asi ("Informado a SWAP HUAWEI / ..."). */
  prefijo?: boolean
}

export interface HitoPerfil {
  nombre: string
  columna: UbicacionColumna
}

export interface EtapaPerfil {
  nombre: string
  tipo: TipoEtapa
  hitos: HitoPerfil[]
  /**
   * Para que tipos de intervencion corre la etapa (regex sobre el Tipo, ya
   * normalizado). En una intervencion a la que no aplica, sus celdas vacias
   * cuentan como "no aplica" en vez de como pendientes.
   */
  aplica?: { si?: string; salvo?: string }
  /** Cierra solo cuando el estatus de la fila dice terminado. */
  cierraConEstatus?: boolean
}

export interface PerfilTracker {
  id: string
  nombre: string
  /** Encabezados que tienen que estar todos para reconocer el formato. */
  firma: string[]
  etapas: EtapaPerfil[]
  /** Estado de la fila: define la vigencia y, si dice terminado, cierra todo. */
  estatus: UbicacionColumna
  terminado: string
  /**
   * Cada fila es una intervencion y no un sitio: el mismo sitio puede tener un
   * Desarme en 2025 y su RWK en 2026. La llave del seguimiento lleva el tipo y
   * el ano para que no se pisen.
   */
  intervencion: { tipo: UbicacionColumna; anio: UbicacionColumna }
}

/** Todo lo que no sea un desarme a secas instala algo en el sitio nuevo. */
const INSTALA = { salvo: '^desarme$' }

export const PERFIL_RWK: PerfilTracker = {
  id: 'control-rwk',
  nombre: 'Control RWK',
  firma: ['Bloqueo de celdas', 'Desarme', 'RFI PMO', 'Baja de sitio-NOC'],
  etapas: [
    {
      nombre: 'Acta',
      tipo: 'secuencial',
      // "Informado Areas" queda como dato del sitio y no como paso: es un aviso,
      // y exigirlo dejaba en Acta a intervenciones que ya estaban instalando HW.
      hitos: [{ nombre: 'Acta', columna: { encabezado: 'Fecha de Acta' } }],
    },
    {
      nombre: 'HW',
      tipo: 'secuencial',
      aplica: INSTALA,
      hitos: [
        { nombre: 'Gabinete', columna: { encabezado: 'Fecha', tras: 'Gabinete' } },
        { nombre: 'CSR', columna: { encabezado: 'Fecha', tras: 'CSR' } },
        { nombre: 'MMOO', columna: { encabezado: 'Fecha', tras: 'MMOO' } },
      ],
    },
    {
      nombre: 'Sitio al aire',
      tipo: 'secuencial',
      aplica: INSTALA,
      hitos: [
        { nombre: 'RFI OOII', columna: { encabezado: 'RFI OOII' } },
        { nombre: 'RFI PMO', columna: { encabezado: 'RFI PMO' } },
        {
          nombre: 'Informado a SWAP',
          columna: { encabezado: 'Informado a SWAP', prefijo: true },
        },
      ],
    },
    {
      // Corre en paralelo a la instalacion: ni el sitio nuevo espera al desarme
      // del antiguo ni al reves.
      nombre: 'Desarme',
      tipo: 'paralela',
      aplica: { si: 'desarme' },
      hitos: [
        { nombre: 'Bloqueo de celdas', columna: { encabezado: 'Bloqueo de celdas' } },
        { nombre: 'Dar de baja', columna: { encabezado: 'Dar de baja' } },
        { nombre: 'Requiere baja de contrato', columna: { encabezado: 'Baja de Contrato' } },
        { nombre: 'Desarme', columna: { encabezado: 'Desarme' } },
        { nombre: 'Desconexión empalme', columna: { encabezado: 'Desconexión Empalme' } },
        { nombre: 'Desconexión FO', columna: { encabezado: 'Desconexión FO' } },
        { nombre: 'Baja NOC', columna: { encabezado: 'Baja de sitio-NOC' } },
        {
          nombre: 'Baja de contrato',
          columna: { encabezado: 'Baja de Contrato', tras: 'Baja de sitio-NOC' },
        },
      ],
    },
    {
      nombre: 'Término',
      tipo: 'secuencial',
      cierraConEstatus: true,
      hitos: [
        { nombre: 'Fecha de término', columna: { encabezado: 'Fecha de termino' } },
        { nombre: 'Paso O&M ECE', columna: { encabezado: 'PASO O&M ECE' } },
      ],
    },
  ],
  estatus: { encabezado: 'Estatus', tras: 'Fecha de termino' },
  terminado: 'terminad',
  intervencion: { tipo: { encabezado: 'Tipo' }, anio: { encabezado: 'Año' } },
}

export const PERFILES: readonly PerfilTracker[] = [PERFIL_RWK]

// --------------------------------------------------------------- ubicacion

function calza(encabezado: string, buscado: string, prefijo: boolean): boolean {
  const e = normalizarTexto(encabezado)
  const b = normalizarTexto(buscado)
  return prefijo ? e.startsWith(b) : e === b
}

/** Indice de la columna, o -1 si el archivo no la tiene. */
export function ubicarColumna(encabezados: readonly string[], u: UbicacionColumna): number {
  let desde = 0
  if (u.tras !== undefined) {
    const ancla = encabezados.findIndex((e) => calza(e, u.tras!, false))
    if (ancla < 0) return -1
    desde = ancla + 1
  }
  for (let i = desde; i < encabezados.length; i++) {
    if (calza(encabezados[i] ?? '', u.encabezado, u.prefijo === true)) return i
  }
  return -1
}

/** El perfil cuyo formato calza con estos encabezados, si alguno calza. */
export function perfilDeEncabezados(encabezados: readonly unknown[]): PerfilTracker | null {
  const textos = encabezados.map((c) => (c === null || c === undefined ? '' : String(c).trim()))
  return (
    PERFILES.find((p) => p.firma.every((f) => ubicarColumna(textos, { encabezado: f }) >= 0)) ??
    null
  )
}

/** Si alguna de las primeras filas es el encabezado de un perfil conocido. */
export function hojaTienePerfil(filas: readonly (readonly unknown[])[], maximo = 12): boolean {
  return filas.slice(0, maximo).some((f) => perfilDeEncabezados(f) !== null)
}

// --------------------------------------------------------------- lectura

/** Lo que el perfil aplicado a un archivo dejo resuelto en indices. */
export interface PerfilAplicado {
  id: string
  nombre: string
  estatus: number | null
  terminado: string
  tipo: number | null
  anio: number | null
  /** Nombre de la etapa -> cuando aplica, y si cierra con el estatus. */
  etapas: Record<string, { aplica?: { si?: string; salvo?: string }; cierraConEstatus?: boolean }>
}

/** Si la etapa corre para una intervencion de este tipo. Sin tipo, corre. */
export function etapaAplica(
  aplica: { si?: string; salvo?: string } | undefined,
  tipo: string,
): boolean {
  if (aplica === undefined) return true
  const t = normalizarTexto(tipo)
  if (t === '') return true
  if (aplica.si !== undefined && !new RegExp(aplica.si).test(t)) return false
  if (aplica.salvo !== undefined && new RegExp(aplica.salvo).test(t)) return false
  return true
}

export interface LecturaHito {
  estado: string
  comentario: string
  fecha: FechaISO | null
}

/**
 * Lee la celda de un hito como una revision: estado, comentario y fecha.
 *
 * - Una fecha dice que el paso se hizo ese dia.
 * - "-", "N/A" o "No" dicen que no corresponde.
 * - "OK", "Pendiente", "En proceso" se leen como cualquier estado.
 * - Cualquier otro texto es una nota de seguimiento ("06-01-26_Consulto a
 *   Marco"): el paso esta en curso y la nota se guarda como comentario.
 * - Vacia, en una intervencion a la que la etapa no aplica, tampoco corresponde.
 */
export function leerHito(crudo: unknown, aplica: boolean): LecturaHito {
  const vacia = crudo === null || crudo === undefined || String(crudo).trim() === ''
  if (vacia) return { estado: aplica ? '' : 'No aplica', comentario: '', fecha: null }

  // Un numero solo es fecha si esta en el rango de los numeros de serie de
  // Excel de estos anos; un "1" suelto no es el 31-12-1899.
  const esSerial = typeof crudo === 'number' && crudo > 30_000 && crudo < 80_000
  if (crudo instanceof Date || esSerial) {
    const fecha = parsearFechaFlexible(crudo)
    if (fecha !== null) return { estado: fecha, comentario: '', fecha }
  }

  const texto = String(crudo).trim()
  // Un punto suelto es una celda que alguien "limpio": no dice nada.
  if (/^[.\s]+$/.test(texto))
    return { estado: aplica ? '' : 'No aplica', comentario: '', fecha: null }
  const fecha = parsearFechaFlexible(texto)
  if (fecha !== null) return { estado: fecha, comentario: '', fecha }
  if (esFechaDeEstado(texto)) return { estado: texto, comentario: '', fecha: null }
  // Solo el ano ("2024" en Desarme): se hizo ese ano, sin dia registrado.
  if (/^(19|20)\d{2}$/.test(texto))
    return { estado: `Terminado ${texto}`, comentario: '', fecha: null }
  // "No existe conexión eléctrica", "N/A, ya ejecutado en Sep-2023": el paso no
  // corresponde, y el porque se guarda.
  if (/^(n\/a|no existe|no aplica)\b/.test(normalizarTexto(texto))) {
    return { estado: 'No aplica', comentario: texto, fecha: null }
  }

  if (clasificarEstado(texto) === 'desconocido') {
    return { estado: 'En proceso', comentario: texto, fecha: null }
  }
  return { estado: texto, comentario: '', fecha: null }
}
