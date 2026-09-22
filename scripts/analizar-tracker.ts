/**
 * Analisis de un tracker real con el mismo motor que usa la importacion.
 *
 *   npx tsx scripts/analizar-tracker.ts "<ruta al .xlsx>" [hoja]
 *
 * No escribe nada. Imprime lo que la app entenderia del archivo: las etapas que
 * propone (y si son secuenciales o paralelas), en que etapa quedaria cada sitio,
 * cuantos quedan fuera de orden, y cuanto coincide el estado deducido de las
 * etapas con la columna consolidada que el tracker mantiene a mano ("Status
 * Sitio"). Sirve para ajustar la inferencia contra archivos reales sin pasar
 * por la pantalla ni por Firestore.
 */
import { readFileSync } from 'node:fs'
import XLSX from '@e965/xlsx'
import { inferirPlantilla } from '../src/domain/tracker/inferencia'
import {
  avanceFueraDeOrden,
  convertirFila,
  indexarColumnas,
  type FilaTracker,
} from '../src/domain/tracker/aplicacion'
import { clasificarEstado } from '../src/domain/tracker/estados'
import { resumirCalidad } from '../src/domain/tracker/calidad'
import {
  estadoSitio,
  estadoSitioDesdeTexto,
  NOMBRES_ESTADO_SITIO,
} from '../src/domain/tracker/estadoSitio'

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: npx tsx scripts/analizar-tracker.ts <archivo.xlsx> [hoja]')
  process.exit(1)
}

const libro = XLSX.read(readFileSync(ruta), { cellDates: true })
const nombreHoja =
  process.argv[3] ??
  (libro.SheetNames.includes('Tracker')
    ? 'Tracker'
    : [...libro.SheetNames].sort((a, b) => {
        const celdas = (n: string) => {
          const ref = libro.Sheets[n]?.['!ref'] ?? 'A1:A1'
          const r = XLSX.utils.decode_range(ref)
          return (r.e.r + 1) * (r.e.c + 1)
        }
        return celdas(b) - celdas(a)
      })[0]!)
const hoja = libro.Sheets[nombreHoja]
if (!hoja) throw new Error(`No existe la hoja ${nombreHoja}`)

const filas = XLSX.utils
  .sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null, blankrows: false })
  .filter(Array.isArray)

const plantilla = inferirPlantilla(filas)
const indice = indexarColumnas(plantilla)
const datos = filas
  .slice(plantilla.filaEncabezado + 1)
  .filter((f) => f.some((c) => c !== null && String(c).trim() !== ''))

const convertidas: FilaTracker[] = datos
  .map((f) => convertirFila(f, plantilla, indice))
  .filter((f) => f.sitio.id !== '')

const contar = <T extends string>(lista: readonly T[]) => {
  const m = new Map<T, number>()
  for (const x of lista) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const pct = (a: number, b: number) => (b === 0 ? '-' : `${((a / b) * 100).toFixed(1)}%`)

console.log(`Archivo: ${ruta}`)
console.log(`Hoja: ${nombreHoja}, encabezado en la fila ${plantilla.filaEncabezado + 1}`)
console.log(`Sitios con ID: ${convertidas.length}`)
console.log('')
console.log('ETAPAS PROPUESTAS')
for (const e of plantilla.etapas) {
  const revisiones = e.revisiones.map((r) => r.nombre).join(', ')
  console.log(
    `  ${e.orden + 1}. ${e.nombre} [${e.tipo}]${revisiones ? ` revisan ${revisiones}` : ''}${
      e.cierraConFecha ? ' (cierra con fecha)' : ''
    }`,
  )
}
const nombreCol = (i: number | undefined) =>
  i === undefined ? '-' : (plantilla.columnas.find((c) => c.indice === i)?.encabezado ?? `#${i}`)
console.log(
  `Condicion: vigencia=${nombreCol(plantilla.condicion.vigencia)} fase=${nombreCol(
    plantilla.condicion.fase,
  )} estadoSitio=${nombreCol(plantilla.condicion.estadoSitio)}`,
)
console.log('')

console.log('ETAPA ACTUAL')
for (const [etapa, n] of contar(convertidas.map((f) => f.etapaActual))) {
  console.log(`  ${String(n).padStart(5)}  ${etapa}`)
}
const fuera = convertidas.filter((f) => avanceFueraDeOrden(f).length > 0)
console.log(`Fuera de orden: ${fuera.length} de ${convertidas.length}`)
for (const [patron, n] of contar(
  fuera.map((f) => `${f.etapaActual} con ${avanceFueraDeOrden(f).join('+')} cerradas`),
).slice(0, 6)) {
  console.log(`  ${String(n).padStart(5)}  ${patron}`)
}
console.log('')

const calidad = resumirCalidad(convertidas, { maximoEjemplos: 0 })
console.log('CALIDAD DEL ARCHIVO')
console.log(`  celdas corregidas por errata: ${calidad.corregidas}`)
console.log(`  celdas "0" (sin dato):        ${calidad.ceros}`)
console.log(`  celdas de estado con fecha:   ${calidad.fechas}`)
console.log(`  no vigentes:                  ${calidad.noVigentes}`)
console.log(`  on hold:                      ${calidad.enHold}`)
console.log('')

console.log('ESTADO DEL SITIO: deducido vs. columna del tracker (sin tecnologia)')
console.log(
  `  comparables ${calidad.comparables}, coinciden ${calidad.coincidencias} (${pct(
    calidad.coincidencias,
    calidad.comparables,
  )}), difieren ${calidad.discrepancias}`,
)
console.log(
  `  por que difieren: vigencia contradictoria ${calidad.porTipo.vigencia}, ` +
    `Status Sitio atrasado respecto de las etapas ${calidad.porTipo.trackerAtrasado}, ` +
    `Status Sitio adelantado ${calidad.porTipo.trackerAdelantado}`,
)
const sinAtraso = calidad.comparables - calidad.porTipo.trackerAtrasado
console.log(
  `  coincidencia sin contar los Status Sitio atrasados: ${pct(calidad.coincidencias, sinAtraso)}`,
)
console.log('  Distribucion deducida:')
for (const [e, n] of contar(convertidas.map((f) => estadoSitio(f).estado))) {
  console.log(`  ${String(n).padStart(5)}  ${NOMBRES_ESTADO_SITIO[e]}`)
}
console.log('  Tecnologia:')
for (const [t, n] of contar(convertidas.map((f) => f.tecnologia ?? '(sin)'))) {
  console.log(`  ${String(n).padStart(5)}  ${t}`)
}
console.log('')

console.log('PATRONES DE DESACUERDO (tracker -> deducido), con la evidencia de las etapas')
const hitos = (f: FilaTracker) =>
  f.etapas
    .filter((e) => e.tipo !== 'paralela')
    .map((e) => `${e.codigo}=${e.cerrada ? 'ok' : (e.consolidado ?? e.resumen)}`)
    .join(' ')
for (const p of calidad.patrones.slice(0, 12)) {
  console.log(
    `  ${String(p.cantidad).padStart(5)}  ${NOMBRES_ESTADO_SITIO[p.tracker]} -> ${
      NOMBRES_ESTADO_SITIO[p.derivado]
    }`,
  )
  const ejemplos = convertidas
    .filter(
      (f) =>
        estadoSitioDesdeTexto(f.estadoSitioTracker) === p.tracker &&
        estadoSitio(f).estado === p.derivado,
    )
    .slice(0, 2)
  for (const f of ejemplos) {
    console.log(`           ${f.sitio.id} "${f.estadoSitioTracker}" | ${hitos(f)}`)
  }
}
console.log('')

// Textos de estado que la heuristica no supo clasificar, por columna.
const desconocidos = new Map<string, number>()
for (const col of plantilla.columnas.filter((c) => c.rol === 'estado')) {
  for (const f of datos) {
    const v = f[col.indice]
    if (v === null || v === undefined || String(v).trim() === '') continue
    if (clasificarEstado(v) === 'desconocido') {
      const k = `${col.encabezado}: ${String(v).trim()}`
      desconocidos.set(k, (desconocidos.get(k) ?? 0) + 1)
    }
  }
}
console.log('ESTADOS SIN CLASIFICAR')
for (const [k, n] of [...desconocidos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(n).padStart(5)}  ${k}`)
}
