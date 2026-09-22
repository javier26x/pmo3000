/**
 * Fechas del dominio.
 *
 * Decision de diseno: las fechas de NEGOCIO (plan/real de un gate, compromiso de
 * un riesgo) se representan como `FechaISO` = 'YYYY-MM-DD', un dia civil sin hora
 * ni zona. Guardarlas como Timestamp UTC las corre un dia al mostrarlas en Chile
 * y eso ensucia todo reporte de cumplimiento. Los sellos de SISTEMA (createdAt,
 * auditoria) si son instantes y viajan como Date/Timestamp.
 */

export type FechaISO = string

export const ZONA_HORARIA = 'America/Santiago'

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

const formateadorISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const formateadorFechaHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Dia de hoy segun el reloj de Chile continental, no el del navegador. */
export function hoyEnChile(ahora: Date = new Date()): FechaISO {
  return formateadorISO.format(ahora)
}

/**
 * Numero de dia (dias desde 1970-01-01) de cada FechaISO ya vista, o null si el
 * texto no es un dia real.
 *
 * Existe por rendimiento: ordenar 4.500 sitios por atraso compara cada uno
 * ~12 veces, y cada comparacion validaba y convertia dos fechas con regex y
 * Date. Pero los dias distintos en juego son pocos cientos, asi que se calculan
 * una vez. El tope evita que un importador con basura haga crecer el mapa.
 */
const DIAS = new Map<string, number | null>()
const TOPE_DIAS = 20_000

function calcularDia(valor: string): number | null {
  const m = RE_ISO.exec(valor)
  if (!m) return null
  const [, a, mes, d] = m
  const anio = Number(a)
  const numMes = Number(mes)
  const dia = Number(d)
  if (numMes < 1 || numMes > 12 || dia < 1 || dia > 31) return null
  const ms = Date.UTC(anio, numMes - 1, dia)
  const fecha = new Date(ms)
  const valido =
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === numMes - 1 &&
    fecha.getUTCDate() === dia
  return valido ? ms / 86_400_000 : null
}

function numeroDeDia(valor: string): number | null {
  let dia = DIAS.get(valor)
  if (dia === undefined) {
    dia = calcularDia(valor)
    if (DIAS.size >= TOPE_DIAS) DIAS.clear()
    DIAS.set(valor, dia)
  }
  return dia
}

/** Valida que el string sea 'YYYY-MM-DD' y ademas un dia real del calendario. */
export function esFechaISO(valor: unknown): valor is FechaISO {
  return typeof valor === 'string' && numeroDeDia(valor) !== null
}

/** 'YYYY-MM-DD' -> 'dd-mm-aaaa' (formato chileno). Puro string: sin zonas horarias. */
export function formatearFecha(fecha: FechaISO | null | undefined): string {
  if (!fecha || !esFechaISO(fecha)) return '—'
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}-${mes}-${anio}`
}

/** Instante -> 'dd-mm-aaaa HH:mm' en horario de Chile. */
export function formatearFechaHora(valor: Date | null | undefined): string {
  if (!valor || Number.isNaN(valor.getTime())) return '—'
  return formateadorFechaHora.format(valor).replace(',', '')
}

function aUTC(fecha: FechaISO): number {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number]
  return Date.UTC(anio, mes - 1, dia)
}

function desdeUTC(ms: number): FechaISO {
  const d = new Date(ms)
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mes}-${dia}`
}

/** Dias calendario entre dos fechas (b - a). Positivo si b es posterior. */
export function diasEntre(a: FechaISO, b: FechaISO): number {
  const diaA = typeof a === 'string' ? numeroDeDia(a) : null
  const diaB = typeof b === 'string' ? numeroDeDia(b) : null
  if (diaA === null || diaB === null) return 0
  return diaB - diaA
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  if (!esFechaISO(fecha)) return fecha
  return desdeUTC(aUTC(fecha) + dias * 86_400_000)
}

/** Dias habiles (lunes a viernes) entre dos fechas. No considera feriados. */
export function diasHabilesEntre(a: FechaISO, b: FechaISO): number {
  if (!esFechaISO(a) || !esFechaISO(b)) return 0
  const signo = aUTC(b) < aUTC(a) ? -1 : 1
  const desde = signo === 1 ? a : b
  const hasta = signo === 1 ? b : a
  let total = 0
  for (let ms = aUTC(desde); ms < aUTC(hasta); ms += 86_400_000) {
    const dia = new Date(ms).getUTCDay()
    if (dia !== 0 && dia !== 6) total += 1
  }
  return total * signo
}

const RE_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/
const RE_YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/

/**
 * Convierte a FechaISO lo que venga de un Excel o un CSV: texto en formato
 * chileno (dd-mm-aaaa, dd/mm/aa), texto ISO, un Date, o el numero de serie de
 * Excel (dias desde 1899-12-30). Devuelve null si no se puede interpretar.
 */
export function parsearFechaFlexible(valor: unknown): FechaISO | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return desdeUTC(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()))
  }

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // Numero de serie de Excel. El epoch es 1899-12-30 por el bug del ano 1900.
    if (valor <= 0 || valor > 2_958_465) return null
    const iso = desdeUTC(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000)
    return esFechaISO(iso) ? iso : null
  }

  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  if (texto === '') return null

  const ymd = RE_YMD.exec(texto)
  if (ymd) {
    const iso = `${ymd[1]}-${ymd[2]!.padStart(2, '0')}-${ymd[3]!.padStart(2, '0')}`
    return esFechaISO(iso) ? iso : null
  }

  const dmy = RE_DMY.exec(texto)
  if (dmy) {
    const anioTexto = dmy[3]!
    // Un ano de dos digitos se interpreta como 20xx: esta PMO no maneja fechas del siglo pasado.
    const anio = anioTexto.length === 2 ? `20${anioTexto}` : anioTexto
    const iso = `${anio}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
    return esFechaISO(iso) ? iso : null
  }

  return null
}
