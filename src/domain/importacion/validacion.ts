import { parsearFechaFlexible, type FechaISO } from '@/domain/fechas'
import { estaEnChile, type SitioNuevo } from '@/domain/tipos/sitio'
import { CAMPOS_POR_CLAVE, type ClaveImportacion } from './campos'
import type { Mapeo } from './mapeo'

export interface ProblemaFila {
  campo: ClaveImportacion | null
  mensaje: string
}

export const ESTADOS_FILA = ['nuevo', 'actualiza', 'duplicado_archivo', 'error'] as const
export type EstadoFila = (typeof ESTADOS_FILA)[number]

export interface FilaImportacion {
  /** Numero de fila del archivo tal como lo ve el usuario (1 = cabecera). */
  numeroFila: number
  sitio: SitioNuevo | null
  programa: string | null
  proveedor: string | null
  fechaInicio: FechaISO | null
  errores: ProblemaFila[]
  avisos: ProblemaFila[]
  estado: EstadoFila
}

export interface ResumenImportacion {
  total: number
  nuevos: number
  actualizan: number
  duplicadosArchivo: number
  conError: number
  conAviso: number
  importables: number
}

function textoCelda(fila: readonly unknown[], indice: number | undefined): string {
  if (indice === undefined) return ''
  const valor = fila[indice]
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

/** Acepta "−33,4372", "-33.4372", "  -33,4372  ". Devuelve null si no es numero. */
export function parsearNumero(texto: string): number | null {
  const limpio = texto
    .replace(/−/g, '-')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  if (limpio === '' || !/^[-+]?\d*\.?\d+$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

export function parsearLista(texto: string): string[] {
  return texto
    .split(/[,;/|]/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/** Valida una fila cruda contra el mapeo. No toca Firestore ni conoce el maestro. */
export function validarFila(
  fila: readonly unknown[],
  mapeo: Mapeo,
  numeroFila: number,
): FilaImportacion {
  const errores: ProblemaFila[] = []
  const avisos: ProblemaFila[] = []

  const id = textoCelda(fila, mapeo.id)
  const nombre = textoCelda(fila, mapeo.nombre)
  const region = textoCelda(fila, mapeo.region)
  const comuna = textoCelda(fila, mapeo.comuna)
  const latTexto = textoCelda(fila, mapeo.lat)
  const lonTexto = textoCelda(fila, mapeo.lon)

  for (const [clave, valor] of [
    ['id', id],
    ['nombre', nombre],
    ['region', region],
    ['comuna', comuna],
  ] as const) {
    if (valor === '') {
      errores.push({ campo: clave, mensaje: `${CAMPOS_POR_CLAVE[clave].etiqueta} es obligatorio` })
    }
  }

  if (id.includes('/')) {
    errores.push({ campo: 'id', mensaje: 'El ID de sitio no puede contener "/"' })
  }
  if (id.length > 120) {
    errores.push({ campo: 'id', mensaje: 'El ID de sitio es demasiado largo' })
  }

  const lat = parsearNumero(latTexto)
  const lon = parsearNumero(lonTexto)

  if (lat === null) {
    errores.push({
      campo: 'lat',
      mensaje: latTexto === '' ? 'Latitud obligatoria' : `Latitud no numerica: "${latTexto}"`,
    })
  } else if (lat < -90 || lat > 90) {
    errores.push({ campo: 'lat', mensaje: 'Latitud fuera de rango (-90 a 90)' })
  }

  if (lon === null) {
    errores.push({
      campo: 'lon',
      mensaje: lonTexto === '' ? 'Longitud obligatoria' : `Longitud no numerica: "${lonTexto}"`,
    })
  } else if (lon < -180 || lon > 180) {
    errores.push({ campo: 'lon', mensaje: 'Longitud fuera de rango (-180 a 180)' })
  }

  // Coordenada valida pero fuera de Chile: aviso, no error. Puede ser un sitio
  // de frontera mal digitado, o lat/lon invertidas. El usuario decide.
  if (lat !== null && lon !== null && !estaEnChile(lat, lon)) {
    const invertidas = estaEnChile(lon, lat)
    avisos.push({
      campo: 'lat',
      mensaje: invertidas
        ? 'Coordenada fuera de Chile: parece que latitud y longitud estan invertidas'
        : 'Coordenada fuera de Chile',
    })
  }

  const fechaTextoCelda = mapeo.fechaInicio !== undefined ? fila[mapeo.fechaInicio] : null
  const fechaInicio = parsearFechaFlexible(fechaTextoCelda)
  if (
    fechaTextoCelda !== null &&
    fechaTextoCelda !== undefined &&
    String(fechaTextoCelda).trim() !== '' &&
    fechaInicio === null
  ) {
    avisos.push({
      campo: 'fechaInicio',
      mensaje: `No se pudo interpretar la fecha "${String(fechaTextoCelda)}"; el sitio se importa sin fecha de inicio`,
    })
  }

  const sitio: SitioNuevo | null =
    errores.length > 0
      ? null
      : {
          id,
          nombre,
          region,
          comuna,
          direccion: textoCelda(fila, mapeo.direccion),
          lat: lat as number,
          lon: lon as number,
          tecnologias: parsearLista(textoCelda(fila, mapeo.tecnologias)),
          tipoSitio: textoCelda(fila, mapeo.tipoSitio),
          carpetaUrl: null,
          activo: true,
        }

  const programa = textoCelda(fila, mapeo.programa)
  const proveedor = textoCelda(fila, mapeo.proveedor)

  return {
    numeroFila,
    sitio,
    programa: programa === '' ? null : programa,
    proveedor: proveedor === '' ? null : proveedor,
    fechaInicio,
    errores,
    avisos,
    estado: errores.length > 0 ? 'error' : 'nuevo',
  }
}

export function filaVacia(fila: readonly unknown[]): boolean {
  return fila.every((c) => c === null || c === undefined || String(c).trim() === '')
}

/**
 * Valida todas las filas y marca duplicados: dentro del mismo archivo (se
 * importa la primera y se descartan las siguientes) y contra el maestro (esas
 * filas actualizan el sitio existente, no lo duplican).
 */
export function validarArchivo(
  filas: readonly (readonly unknown[])[],
  mapeo: Mapeo,
  idsExistentes: ReadonlySet<string>,
): FilaImportacion[] {
  const vistos = new Map<string, number>()
  const resultado: FilaImportacion[] = []

  filas.forEach((fila, i) => {
    if (filaVacia(fila)) return
    // +2: la fila 1 del archivo es la cabecera.
    const validada = validarFila(fila, mapeo, i + 2)

    if (validada.sitio) {
      const id = validada.sitio.id
      const previa = vistos.get(id)
      if (previa !== undefined) {
        validada.estado = 'duplicado_archivo'
        validada.errores.push({
          campo: 'id',
          mensaje: `ID repetido en el archivo (ya aparece en la fila ${previa})`,
        })
      } else {
        vistos.set(id, validada.numeroFila)
        validada.estado = idsExistentes.has(id) ? 'actualiza' : 'nuevo'
      }
    }

    resultado.push(validada)
  })

  return resultado
}

export function resumirImportacion(filas: readonly FilaImportacion[]): ResumenImportacion {
  const cuenta = (estado: EstadoFila) => filas.filter((f) => f.estado === estado).length
  return {
    total: filas.length,
    nuevos: cuenta('nuevo'),
    actualizan: cuenta('actualiza'),
    duplicadosArchivo: cuenta('duplicado_archivo'),
    conError: cuenta('error'),
    conAviso: filas.filter((f) => f.avisos.length > 0).length,
    importables: filas.filter((f) => f.estado === 'nuevo' || f.estado === 'actualiza').length,
  }
}
