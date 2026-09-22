/**
 * Lectura de planillas. Las librerias pesadas se cargan con import() dinamico
 * para que no entren al bundle inicial: solo se descargan al abrir el importador.
 *
 * Sobre Excel: SheetJS salio de npm y la ultima version publicada ahi (0.18.5)
 * arrastra un CVE de prototype pollution. Usamos @e965/xlsx, que es el build
 * oficial 0.20.3 republicado en npm (misma API, ya corregido).
 */

export interface ArchivoTabular {
  nombre: string
  hoja: string | null
  hojas: string[]
  cabeceras: string[]
  filas: unknown[][]
}

export const EXTENSIONES_ACEPTADAS = '.xlsx,.xlsm,.xls,.csv,.txt'

const MAX_BYTES = 25 * 1024 * 1024

function esCsv(nombre: string): boolean {
  return /\.(csv|txt)$/i.test(nombre)
}

/**
 * Decodifica texto probando UTF-8 y, si aparecen caracteres de reemplazo,
 * Windows-1252: los CSV exportados desde Excel en Chile suelen venir en esa
 * codificacion y de otro modo las tildes y la enie llegan corruptas.
 */
function decodificar(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  try {
    return new TextDecoder('windows-1252').decode(buffer)
  } catch {
    return utf8
  }
}

async function leerCsv(archivo: File): Promise<ArchivoTabular> {
  const { default: Papa } = await import('papaparse')
  const texto = decodificar(await archivo.arrayBuffer())

  const resultado = Papa.parse<unknown[]>(texto, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  })

  const filas = (resultado.data ?? []).filter(Array.isArray)
  const cabeceras = (filas.shift() ?? []).map((c) => String(c ?? '').trim())

  return { nombre: archivo.name, hoja: null, hojas: [], cabeceras, filas }
}

async function leerExcel(archivo: File, hojaPedida?: string): Promise<ArchivoTabular> {
  const XLSX = await import('@e965/xlsx')
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true })

  const hojas = libro.SheetNames
  const hoja = hojaPedida && hojas.includes(hojaPedida) ? hojaPedida : hojas[0]
  if (!hoja) throw new Error('El archivo no tiene hojas con datos')

  const pagina = libro.Sheets[hoja]
  if (!pagina) throw new Error(`No se pudo leer la hoja "${hoja}"`)

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(pagina, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })

  const filas = matriz.filter(Array.isArray)
  const cabeceras = (filas.shift() ?? []).map((c) => String(c ?? '').trim())

  return { nombre: archivo.name, hoja, hojas, cabeceras, filas }
}

export async function leerArchivoTabular(archivo: File, hoja?: string): Promise<ArchivoTabular> {
  if (archivo.size === 0) throw new Error('El archivo esta vacio')
  if (archivo.size > MAX_BYTES) {
    throw new Error('El archivo supera los 25 MB. Dividelo o exporta solo las columnas necesarias.')
  }

  const resultado = esCsv(archivo.name) ? await leerCsv(archivo) : await leerExcel(archivo, hoja)

  if (resultado.cabeceras.length === 0) {
    throw new Error('No se encontro la fila de cabeceras en la primera linea')
  }
  return resultado
}
