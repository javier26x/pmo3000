/**
 * Campos de un tracker.
 *
 * El maestro de sitios tiene columnas fijas (id, nombre, coordenadas) porque son
 * las que la app necesita para funcionar. Todo lo demas es del negocio y cambia
 * por proyecto: un tracker trae "Concurso 5G", "Etapa Subtel" y "Responsable
 * Gabinete", el otro trae "Clasificacion AMX" y "Prioridad RF". Entre dos
 * trackers reales de la misma PMO hay mas de 130 columnas distintas.
 *
 * Por eso las columnas no se codifican: se DECLARAN en la plantilla del
 * programa, con un tipo, y el valor viaja en sitioProyecto.valores. Agregar una
 * columna no toca codigo ni reglas.
 */
import { formatearFecha, parsearFechaFlexible, type FechaISO } from '@/domain/fechas'
import { clasificarEstado, NOMBRES_ESTADO, type EstadoSemantico } from './estados'

export const TIPOS_CAMPO = [
  'texto',
  'texto_largo',
  'numero',
  'fecha',
  'semana',
  'opcion',
  'booleano',
  'estado',
] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export const NOMBRES_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  texto_largo: 'Texto largo',
  numero: 'Número',
  fecha: 'Fecha',
  semana: 'Semana',
  opcion: 'Lista de opciones',
  booleano: 'Sí / No',
  estado: 'Estado',
}

export const AYUDA_TIPO: Record<TipoCampo, string> = {
  texto: 'Una línea. Códigos, nombres, referencias.',
  texto_largo: 'Varias líneas. Comentarios y observaciones de revisión.',
  numero: 'Cantidades: días de SLA, altura, prioridad.',
  fecha: 'Día calendario. Se muestra dd-mm-aaaa.',
  semana: 'Semana del año, como W34-2026. Se ordena cronológicamente.',
  opcion: 'Lista cerrada de valores. Se puede filtrar y agrupar por ella.',
  booleano: 'Sí o no.',
  estado: 'Estado de una revisión. Se clasifica para contar avance y pintar color.',
}

/** Lo que se guarda en Firestore. Sin Date: las fechas van como texto civil. */
export type ValorCampo = string | number | boolean | null

export interface CampoDefinicion {
  /** Estable y derivado del encabezado: la reimportacion depende de el. */
  id: string
  /** El encabezado tal como lo escribe el negocio. Es lo que se muestra. */
  nombre: string
  tipo: TipoCampo
  /** Agrupa los campos en la ficha. Suele ser la etapa: TSS, Ingeniería… */
  grupo: string
  /** Valores conocidos, para tipo 'opcion'. No es una restricción: es ayuda. */
  opciones: readonly string[]
  /** Si aparece como columna en la tabla. Con 130 campos, casi ninguno. */
  enTabla: boolean
  /** Encabezado exacto del archivo de origen, para reconocer la columna. */
  origen: string | null
}

/**
 * Id estable a partir del encabezado: minusculas, sin tildes, con guiones.
 *
 * Tiene que sobrevivir a que alguien corrija un espacio o una mayuscula en la
 * planilla, porque si el id cambia la reimportacion crea un campo nuevo en vez
 * de actualizar el que ya existe.
 */
export function idDeEncabezado(encabezado: string): string {
  const base = encabezado
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base === '' ? 'campo' : base.slice(0, 60)
}

/** Ids unicos aunque dos encabezados se normalicen igual ("Fecha " y "fecha"). */
export function idUnico(encabezado: string, tomados: ReadonlySet<string>): string {
  const base = idDeEncabezado(encabezado)
  if (!tomados.has(base)) return base
  for (let i = 2; i < 500; i++) {
    const intento = `${base}-${i}`
    if (!tomados.has(intento)) return intento
  }
  return `${base}-${Date.now()}`
}

const RE_SEMANA = /^\s*(?:w\s*(\d{1,2})\s*[-/ ]\s*(\d{4})|(\d{4})\s*[-/ ]\s*w\s*(\d{1,2}))\s*$/i

/**
 * Normaliza una semana a "2026-W34", que ordena cronologicamente como texto.
 *
 * Los trackers la escriben de todas las formas: "W37 2024", "W34-2026",
 * "2024-W26", "w12-2024". Y traen "W52 1900", que es lo que produce Excel
 * cuando la formula de semana recibe una celda vacia: eso se descarta.
 */
export function normalizarSemana(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null
  const m = RE_SEMANA.exec(crudo)
  if (!m) return null
  const semana = Number(m[1] ?? m[4])
  const anio = Number(m[2] ?? m[3])
  if (!Number.isFinite(semana) || !Number.isFinite(anio)) return null
  if (semana < 1 || semana > 53) return null
  if (anio < 2000 || anio > 2100) return null
  return `${anio}-W${String(semana).padStart(2, '0')}`
}

/** Semana ISO de una fecha, en el mismo formato que normalizarSemana. */
export function semanaDeFecha(fecha: FechaISO): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number]
  const dia = new Date(Date.UTC(a, m - 1, d))
  // Norma ISO 8601: la semana pertenece al año del jueves de esa semana.
  const diaSemana = (dia.getUTCDay() + 6) % 7
  dia.setUTCDate(dia.getUTCDate() - diaSemana + 3)
  const jueves = dia.getTime()
  const anio = dia.getUTCFullYear()
  const primerJueves = new Date(Date.UTC(anio, 0, 4))
  primerJueves.setUTCDate(primerJueves.getUTCDate() - ((primerJueves.getUTCDay() + 6) % 7) + 3)
  const semana = 1 + Math.round((jueves - primerJueves.getTime()) / (7 * 86_400_000))
  return `${anio}-W${String(semana).padStart(2, '0')}`
}

/** Semana con año fuera de rango: Excel sobre una fecha vacía. */
export function esCentinelaDeSemana(crudo: unknown): boolean {
  if (typeof crudo !== 'string') return false
  const m = RE_SEMANA.exec(crudo)
  if (!m) return false
  const anio = Number(m[2] ?? m[3])
  return Number.isFinite(anio) && (anio < 2000 || anio > 2100)
}

const VERDADEROS = new Set(['si', 'sí', 'yes', 'true', 'verdadero', 'x', '1', 'ok'])
const FALSOS = new Set(['no', 'false', 'falso', '0', '-'])

export type Coercion = { ok: true; valor: ValorCampo } | { ok: false; motivo: string }

/**
 * Convierte lo que venga de una celda al valor que corresponde al tipo.
 *
 * Nunca descarta informacion en silencio: si no puede convertir, lo dice y quien
 * importa decide. Un tracker de anos tiene celdas con cualquier cosa, y perder
 * una sin avisar es peor que importarla como texto.
 */
export function coercionar(tipo: TipoCampo, crudo: unknown): Coercion {
  if (crudo === null || crudo === undefined) return { ok: true, valor: null }
  if (typeof crudo === 'string' && crudo.trim() === '') return { ok: true, valor: null }

  switch (tipo) {
    case 'texto':
    case 'texto_largo':
    case 'opcion': {
      const texto =
        crudo instanceof Date ? formatearFecha(parsearFechaFlexible(crudo)) : String(crudo)
      return { ok: true, valor: texto.trim() }
    }

    case 'estado': {
      // El texto original se guarda tal cual; la clasificación se calcula al
      // leer, con la homologación de la plantilla, que puede cambiar después.
      // Una fecha en una celda de estado se guarda como fecha legible y no como
      // el "Wed Sep 03 2025 00:00:00 GMT-0400" que deja String() sobre un Date.
      if (crudo instanceof Date) {
        return { ok: true, valor: formatearFecha(parsearFechaFlexible(crudo)) }
      }
      return { ok: true, valor: String(crudo).trim() }
    }

    case 'numero': {
      if (typeof crudo === 'number') {
        return Number.isFinite(crudo)
          ? { ok: true, valor: crudo }
          : { ok: false, motivo: 'número inválido' }
      }
      const texto = String(crudo).trim().replace(/\./g, '').replace(',', '.')
      const n = Number(texto)
      if (texto === '' || Number.isNaN(n))
        return { ok: false, motivo: `"${String(crudo)}" no es un número` }
      return { ok: true, valor: n }
    }

    case 'fecha': {
      const fecha = parsearFechaFlexible(crudo)
      if (fecha === null)
        return { ok: false, motivo: `no se pudo leer la fecha "${String(crudo)}"` }
      return { ok: true, valor: fecha }
    }

    case 'semana': {
      const semana = normalizarSemana(typeof crudo === 'string' ? crudo : String(crudo))
      if (semana !== null) return { ok: true, valor: semana }
      // "W52 1900" es lo que devuelve la fórmula de semana de Excel cuando la
      // fecha de origen está vacía. Es una celda sin dato, no un error: contarlo
      // como problema llenaría el informe de importación de falsas alarmas.
      if (esCentinelaDeSemana(crudo)) return { ok: true, valor: null }
      // Muchas columnas de semana son fórmulas sobre una fecha: si viene la
      // fecha, la semana se deriva y no se pierde el dato.
      const fecha = parsearFechaFlexible(crudo)
      if (fecha !== null) return { ok: true, valor: semanaDeFecha(fecha) }
      return { ok: false, motivo: `no se pudo leer la semana "${String(crudo)}"` }
    }

    case 'booleano': {
      if (typeof crudo === 'boolean') return { ok: true, valor: crudo }
      const texto = String(crudo).trim().toLowerCase()
      if (VERDADEROS.has(texto)) return { ok: true, valor: true }
      if (FALSOS.has(texto)) return { ok: true, valor: false }
      return { ok: false, motivo: `"${String(crudo)}" no es un sí ni un no` }
    }
  }
}

/** Texto para mostrar. Para 'estado' devuelve el original, no la clasificación. */
export function formatearValor(tipo: TipoCampo, valor: ValorCampo): string {
  if (valor === null) return ''
  switch (tipo) {
    case 'fecha':
      return typeof valor === 'string' ? formatearFecha(valor as FechaISO) : ''
    case 'semana':
      // "2026-W34" se lee mejor como "W34-2026", que es como lo escribe la PMO.
      return typeof valor === 'string' && valor.includes('-W')
        ? `${valor.slice(5)}-${valor.slice(0, 4)}`
        : String(valor)
    case 'booleano':
      return valor === true ? 'Sí' : 'No'
    case 'numero':
      return typeof valor === 'number' ? valor.toLocaleString('es-CL') : String(valor)
    default:
      return String(valor)
  }
}

/** Clasificación semántica de un campo de estado. Ver tracker/estados.ts. */
export function estadoDeValor(
  valor: ValorCampo,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
): EstadoSemantico {
  return clasificarEstado(valor === null ? null : String(valor), homologacion)
}

/** Etiqueta legible de la clasificación, para leyendas y filtros. */
export function nombreEstadoDeValor(
  valor: ValorCampo,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
): string {
  return NOMBRES_ESTADO[estadoDeValor(valor, homologacion)]
}

/** Orden natural del tipo, para que la tabla ordene como la gente espera. */
export function comparar(tipo: TipoCampo, a: ValorCampo, b: ValorCampo): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (tipo === 'numero') return Number(a) - Number(b)
  if (tipo === 'booleano') return Number(a) - Number(b)
  // fecha ('YYYY-MM-DD') y semana ('2026-W34') ya ordenan como texto.
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}
