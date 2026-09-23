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

/** Todas las filas tal como estan, sin tocar. */
export interface ArchivoCrudo {
  nombre: string
  hoja: string
  hojas: string[]
  filas: unknown[][]
}

/**
 * Lee la hoja completa SIN asumir donde esta el encabezado.
 *
 * leerArchivoTabular da por hecho que la primera fila son las cabeceras, que es
 * cierto para una exportacion limpia. Un tracker de verdad no: arriba trae filas
 * de contadores, de formulas o vacias, y el encabezado puede estar en la segunda
 * o la tercera. Quien decide cual es la fila de encabezado es la inferencia
 * (domain/tracker/inferencia.ts), asi que necesita la hoja entera.
 */
export async function leerHojaCruda(archivo: File, hojaPedida?: string): Promise<ArchivoCrudo> {
  if (archivo.size === 0) throw new Error('El archivo esta vacio')
  if (archivo.size > MAX_BYTES) {
    throw new Error('El archivo supera los 25 MB. Dividelo o exporta solo las columnas necesarias.')
  }

  const XLSX = await import('@e965/xlsx')
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true })
  const hojas = libro.SheetNames
  const hoja =
    hojaPedida && hojas.includes(hojaPedida)
      ? hojaPedida
      : ((await hojaDePerfil(hojas, libro)) ?? elegirHoja(hojas, libro))
  const pagina = libro.Sheets[hoja]
  if (!pagina) throw new Error(`No se pudo leer la hoja "${hoja}"`)

  const filas = XLSX.utils
    .sheet_to_json<unknown[]>(pagina, { header: 1, raw: true, defval: null, blankrows: false })
    .filter(Array.isArray)

  return { nombre: archivo.name, hoja, hojas, filas }
}

/**
 * La hoja cuyo encabezado es el de un formato conocido (domain/tracker/perfiles).
 *
 * El control de RWK trae veintisiete hojas y la mas grande es un inventario de
 * gabinetes: por tamano se eligiria mal. Solo se leen las primeras filas de
 * cada hoja, que es donde esta el encabezado.
 */
async function hojaDePerfil(
  hojas: readonly string[],
  libro: { Sheets: Record<string, unknown> },
): Promise<string | null> {
  const XLSX = await import('@e965/xlsx')
  const { hojaTienePerfil } = await import('@/domain/tracker/perfiles')
  for (const nombre of hojas) {
    const pagina = libro.Sheets[nombre] as Parameters<typeof XLSX.utils.sheet_to_json>[0]
    const ref = (pagina as { '!ref'?: string } | undefined)?.['!ref']
    if (ref === undefined) continue
    const rango = XLSX.utils.decode_range(ref)
    rango.e.r = Math.min(rango.e.r, rango.s.r + 11)
    const primeras = XLSX.utils
      .sheet_to_json<unknown[]>(pagina, { header: 1, raw: true, defval: null, range: rango })
      .filter(Array.isArray)
    if (hojaTienePerfil(primeras)) return nombre
  }
  return null
}

/**
 * Cual hoja es el tracker.
 *
 * Estos libros traen hojas de apoyo —busquedas, homologaciones, listas de
 * sitios sueltas— y la del tracker es, sin excepcion en los archivos reales, la
 * que tiene mas celdas. Se elige esa y se deja cambiarla a mano.
 */
function elegirHoja(hojas: readonly string[], libro: { Sheets: Record<string, unknown> }): string {
  let mejor = hojas[0] ?? ''
  let mayor = -1
  for (const nombre of hojas) {
    const pagina = libro.Sheets[nombre] as { '!ref'?: string } | undefined
    const ref = pagina?.['!ref']
    if (ref === undefined) continue
    const [, fin] = ref.split(':')
    const columnas = (fin ?? '').replace(/\d/g, '').length
    const filas = Number((fin ?? '').replace(/\D/g, '')) || 0
    const celdas = filas * Math.max(columnas, 1)
    if (celdas > mayor) {
      mayor = celdas
      mejor = nombre
    }
  }
  return mejor
}

/**
 * Arma el libro del tracker de ejemplo: la hoja del tracker primero y las
 * instrucciones despues. La del tracker tiene que ser la mas grande para que
 * elegirHoja la tome sola al volver a subir el archivo.
 */
export async function libroTrackerEjemplo(): Promise<ArrayBuffer> {
  const XLSX = await import('@e965/xlsx')
  const { ENCABEZADO_EJEMPLO, INSTRUCCIONES_EJEMPLO, filasTrackerEjemplo } =
    await import('@/domain/tracker/ejemplo')

  const tracker = XLSX.utils.aoa_to_sheet(filasTrackerEjemplo(), {
    cellDates: true,
    dateNF: 'dd-mm-yyyy',
  })
  tracker['!cols'] = ENCABEZADO_EJEMPLO.map((c) => ({ wch: Math.max(12, c.length + 2) }))
  tracker['!autofilter'] = { ref: tracker['!ref'] ?? 'A1' }

  const instrucciones = XLSX.utils.aoa_to_sheet(INSTRUCCIONES_EJEMPLO)
  instrucciones['!cols'] = [{ wch: 100 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, tracker, 'Tracker')
  XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')
  return XLSX.write(libro, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer
}

/** Descarga el tracker de ejemplo como "Tracker de ejemplo PMO3000.xlsx". */
export async function descargarTrackerEjemplo(): Promise<void> {
  const datos = await libroTrackerEjemplo()
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = 'Tracker de ejemplo PMO3000.xlsx'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
