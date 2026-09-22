/**
 * Inferencia de la plantilla de un tracker a partir del archivo.
 *
 * Un tracker de PMO no se disena: crece. Empieza con quince columnas y termina
 * con ciento cuarenta, agregadas por gente distinta a lo largo de anos. Pedirle
 * a alguien que declare esas ciento cuarenta columnas a mano antes de poder usar
 * la app es pedirle que no la use.
 *
 * Asi que la app lee el archivo y PROPONE la plantilla: que etapas tiene el
 * proceso, que revisiones hay dentro de cada una, y de que tipo es cada columna.
 * La propuesta se revisa y se corrige antes de importar nada; no se adivina en
 * silencio.
 *
 * Dos observaciones sobre estos archivos hacen que la inferencia funcione:
 *
 * 1. El proceso esta escrito en las columnas "Status X": cada una nombra una
 *    etapa y, si la hay, la disciplina que revisa ("Status Ing OOCC" es la
 *    revision de Obras Civiles dentro de Ingenieria).
 * 2. El orden de izquierda a derecha ES el orden del proceso. Nadie pone la
 *    columna de As Built antes que la de TSS. De ahi sale la secuencia, sin
 *    tener que codificar ninguna lista de etapas.
 */
import {
  coercionar,
  idUnico,
  normalizarSemana,
  type CampoDefinicion,
  type TipoCampo,
} from './campos'
import { normalizarTexto } from './estados'
import type { TipoEtapa } from '@/domain/gates/catalogo'

// --------------------------------------------------------------- identidad

/** Columnas que la app necesita si o si, con los alias de las planillas reales. */
const ALIAS_IDENTIDAD = {
  id: ['id sitio', 'idsitio', 'id', 'sitio', 'site id', 'codigo sitio', 'id site'],
  nombre: ['site name', 'nombre sitio', 'nombre del sitio', 'nombre', 'name'],
  lat: ['latitud', 'lat', 'latitude'],
  lon: ['longitud', 'long', 'lon', 'longitude'],
  region: ['region', 'region administrativa'],
  comuna: ['comuna', 'ciudad'],
  direccion: ['direccion', 'domicilio', 'address'],
} as const

export type ClaveIdentidad = keyof typeof ALIAS_IDENTIDAD

// --------------------------------------------------------------- disciplinas

/**
 * Disciplinas que revisan. La lista es una SEMILLA para desambiguar, no un
 * limite: cualquier token que aparezca como cola de una columna "Status" en dos
 * etapas distintas se reconoce como disciplina aunque no este aqui.
 */
const DISCIPLINAS_CONOCIDAS: Record<string, string> = {
  rf: 'RF',
  oocc: 'OOCC',
  ece: 'ECE',
  ooii: 'OOII',
  mmoo: 'MMOO',
  ooee: 'OOEE',
  implementacion: 'Implementación',
  inmobiliaria: 'Inmobiliaria',
  operaciones: 'Operaciones',
}

/** Nombres con que la PMO escribe la misma etapa. */
const ALIAS_ETAPA: Record<string, string> = {
  tss: 'TSS',
  tssr: 'TSS',
  ing: 'Ingeniería',
  ingenieria: 'Ingeniería',
  asbuilt: 'As Built',
  'as built': 'As Built',
  'as-built': 'As Built',
  fc: 'FC',
  contrato: 'Contrato',
  tx: 'Transmisión',
  ipran: 'IPRAN',
  uan: 'UAN',
  dom: 'DOM',
  subtel: 'Subtel',
  empalme: 'Empalme',
  // "Estado OOCC" es el avance de las obras civiles en terreno: la etapa de
  // construccion. OOCC como disciplina que revisa ("Status Ing OOCC") no pasa
  // por aca, porque la cola de un encabezado se lee antes como disciplina.
  oocc: 'Construcción',
  construccion: 'Construcción',
  'obras civiles': 'Construcción',
  'on air': 'On Air',
  onair: 'On Air',
}

function nombreEtapa(crudo: string): string {
  const clave = normalizarTexto(crudo)
  return ALIAS_ETAPA[clave] ?? crudo.trim()
}

/**
 * Etapas que son requisitos paralelos y no pasos del proceso.
 *
 * En el tracker Outdoor el proceso es TSS -> Ingenieria -> Construccion -> As
 * Built -> On Air. El FC, el contrato, el DOM, la transmision, el IPRAN, la
 * energia (OOEE, empalme), Subtel y el API firmado corren al lado: se exigen,
 * pero un sitio con el contrato sin firmar puede estar perfectamente en
 * construccion. Tratarlos como pasos dejaba a 1.169 de 1.388 sitios "en FC".
 *
 * Es la unica lista de esto en la app. Solo se aplica a etapas SIN revisiones
 * por disciplina: una etapa que revisan RF y OOCC es un paso del proceso, se
 * llame como se llame. Y es una propuesta: en la revision de la plantilla cada
 * etapa se puede cambiar a mano.
 */
export const PALABRAS_ETAPA_PARALELA = [
  'fc',
  'contrato',
  'dom',
  'transmision',
  'tx',
  'ipran',
  'uan',
  'ooee',
  'energia',
  'subtel',
  'api',
  'empalme',
] as const

export function esNombreDeEtapaParalela(nombre: string): boolean {
  const palabras = normalizarTexto(nombre).split(/[^a-z0-9]+/)
  return palabras.some((p) => (PALABRAS_ETAPA_PARALELA as readonly string[]).includes(p))
}

/** Tipo que se propone para una etapa. Ver PALABRAS_ETAPA_PARALELA. */
export function tipoPropuestoDeEtapa(nombre: string, conRevisiones: boolean): TipoEtapa {
  return !conRevisiones && esNombreDeEtapaParalela(nombre) ? 'paralela' : 'secuencial'
}

/**
 * La columna consolidada del sitio ("Status Sitio") NO es una etapa: es el
 * resultado que alguien escribe a mano a partir de las etapas. Si se leyera
 * como etapa quedaria ultima, abierta para siempre ("On Air 4G" no es un
 * aprobado) y todos los sitios quedarian fuera de orden. Se guarda aparte, solo
 * para compararla con lo que dicen las etapas.
 */
const RE_ESTADO_SITIO = /^(status|estado)s?\s+(del\s+)?(sitio|consolidados?|general)$/i

/** "Vigencia": si el sitio sigue en el plan. */
const ALIAS_VIGENCIA = ['vigencia', 'vigente', 'estado vigencia', 'vigencia sitio']

/** La columna de fase del proyecto, donde tambien se anota "On Hold" o "Eliminado". */
const ALIAS_FASE = ['proyecto', 'fase', 'fase proyecto', 'etapa proyecto']

/** "Sitios On air" y "Fecha Sitio On Air": el hito final del proceso. */
const RE_ON_AIR = /^(sitios?\s+)?on\s*air$/
const RE_FECHA_ON_AIR = /^fecha\s+(de\s+)?(sitio\s+)?on\s*air$/

const ETAPA_ON_AIR = 'On Air'

/**
 * Todas las formas en que un encabezado puede nombrar a una etapa.
 *
 * Hace falta porque la etapa se guarda con su nombre bueno ("Ingeniería") pero
 * las columnas la escriben corta: "Comentarios Ing OOCC", "W Ing Aprobación".
 * Buscando solo el nombre bueno, media docena de columnas del bloque de
 * ingenieria se van a la etapa equivocada.
 */
/**
 * `token` aparece en `texto` como palabra entera: "Ing" no calza dentro de
 * "Ingreso". Ambos ya normalizados. El token viene de un encabezado del
 * archivo, asi que se escapa: "Status TSS (RF" no debe romper la importacion.
 */
export function calzaPalabra(texto: string, token: string): boolean {
  const escapado = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escapado}([^a-z0-9]|$)`).test(texto)
}

function tokensDeEtapa(nombre: string): string[] {
  const propio = normalizarTexto(nombre)
  const alias = Object.entries(ALIAS_ETAPA)
    .filter(([, valor]) => normalizarTexto(valor) === propio)
    .map(([clave]) => clave)
  return [...new Set([propio, ...alias])]
}

// --------------------------------------------------------------- tipos

const RE_ESTADO = /^(status|estado)\b/i
const RE_COMENTARIO = /(comentario|observacion|obs\b|detalle)/i
const RE_SEMANA_ENCABEZADO = /^(w |week|semana)\b|\bweek\b|\bw\b$/i

function esFecha(v: unknown): boolean {
  return v instanceof Date && !Number.isNaN(v.getTime())
}

/**
 * Tipo de una columna a partir de lo que realmente tiene adentro.
 *
 * El encabezado ayuda pero no manda: hay columnas llamadas "Status Tx" que
 * contienen "Poste" y "ODF Instalado", que son un tipo de solucion y no un
 * estado de revision. Se mira el contenido y se usa el encabezado para desempatar.
 */
export function inferirTipo(
  encabezado: string,
  valores: readonly unknown[],
): { tipo: TipoCampo; opciones: string[] } {
  const llenos = valores.filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  if (llenos.length === 0) return { tipo: 'texto', opciones: [] }

  const fechas = llenos.filter(esFecha).length
  if (fechas / llenos.length >= 0.8) return { tipo: 'fecha', opciones: [] }

  const semanas = llenos.filter(
    (v) => normalizarSemana(typeof v === 'string' ? v : '') !== null,
  ).length
  if (semanas / llenos.length >= 0.6) return { tipo: 'semana', opciones: [] }
  // Una columna de semana derivada de una fecha llega con fechas adentro; el
  // encabezado es lo único que distingue "W Aprobación RF" de la fecha misma.
  if (RE_SEMANA_ENCABEZADO.test(encabezado.trim()) && fechas > 0) {
    return { tipo: 'semana', opciones: [] }
  }

  const textos = llenos.map((v) => String(v).trim())
  const distintos = [...new Set(textos)]

  const numeros = llenos.filter((v) => typeof v === 'number' && Number.isFinite(v)).length
  if (numeros / llenos.length >= 0.9 && !/\bid\b|codigo/i.test(encabezado)) {
    return { tipo: 'numero', opciones: [] }
  }

  const comoBooleano = new Set(['si', 'sí', 'no', 'true', 'false', '1', '0', 'x', '-'])
  if (distintos.length <= 3 && distintos.every((t) => comoBooleano.has(t.toLowerCase()))) {
    return { tipo: 'booleano', opciones: [] }
  }

  if (RE_ESTADO.test(encabezado) && distintos.length <= 60) {
    return { tipo: 'estado', opciones: distintos.sort() }
  }

  const largo = Math.max(...textos.map((t) => t.length))
  if (largo > 120 || textos.some((t) => t.includes('\n'))) {
    return { tipo: 'texto_largo', opciones: [] }
  }

  // Lista cerrada: pocos valores distintos y muy repetidos. El umbral relativo
  // evita que una columna de 300 nombres propios pase por lista de opciones.
  if (distintos.length <= 30 && distintos.length / llenos.length <= 0.25) {
    return { tipo: 'opcion', opciones: distintos.sort((a, b) => a.localeCompare(b, 'es')) }
  }

  return { tipo: 'texto', opciones: [] }
}

// --------------------------------------------------------------- resultado

/**
 * - vigencia: si el sitio sigue en el plan ("Vigencia"). Se guarda como campo y
 *   ademas define `vigente` del seguimiento.
 * - estadoSitio: el estado consolidado que el tracker escribe a mano ("Status
 *   Sitio"). No es una etapa; se guarda como campo y sirve para comparar.
 */
export type RolColumna =
  | 'identidad'
  | 'estado'
  | 'comentario'
  | 'fecha'
  | 'semana'
  | 'atributo'
  | 'vigencia'
  | 'estadoSitio'

export interface ColumnaInferida {
  indice: number
  encabezado: string
  campo: CampoDefinicion
  etapa: string | null
  revision: string | null
  rol: RolColumna
  /** Proporcion de filas con dato, de 0 a 1. Una columna vacia no vale la pena. */
  llenado: number
  ejemplos: string[]
  /** Cuantas celdas no se pudieron convertir al tipo propuesto. */
  noConvertibles: number
}

export interface EtapaInferida {
  id: string
  nombre: string
  orden: number
  /** Paso del proceso o requisito paralelo. Ver PALABRAS_ETAPA_PARALELA. */
  tipo: TipoEtapa
  revisiones: { id: string; nombre: string }[]
  /**
   * Si una fecha en la columna de fecha de la etapa basta para cerrarla. Es el
   * caso de On Air: "Fecha Sitio On Air" llena dice que el sitio salio al aire
   * aunque nadie haya escrito "On Air" al lado.
   */
  cierraConFecha?: boolean
}

/** Columnas que no son etapas pero dicen algo de la condicion del sitio. */
export interface CondicionInferida {
  vigencia?: number
  fase?: number
  estadoSitio?: number
}

export interface PlantillaInferida {
  filaEncabezado: number
  etapas: EtapaInferida[]
  columnas: ColumnaInferida[]
  identidad: Partial<Record<ClaveIdentidad, number>>
  condicion: CondicionInferida
  avisos: string[]
}

/**
 * Cual de las primeras filas es el encabezado.
 *
 * Estos archivos no empiezan en la fila 1: arriba hay filas de contadores, de
 * formulas o simplemente en blanco. La fila de encabezado es la que tiene mas
 * celdas de texto distintas entre si.
 */
export function detectarFilaEncabezado(filas: readonly unknown[][], maximo = 12): number {
  let mejor = 0
  let mejorPuntaje = -1
  for (let i = 0; i < Math.min(filas.length, maximo); i++) {
    const fila = filas[i] ?? []
    const textos = fila.filter((c) => typeof c === 'string' && c.trim().length > 1)
    const distintos = new Set(textos.map((c) => String(c).trim().toLowerCase())).size
    // Se premia la variedad y se castiga repetir: una fila con 40 celdas iguales
    // es una fila de relleno, no un encabezado.
    const puntaje = distintos * 2 - (textos.length - distintos)
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejor = i
    }
  }
  return mejor
}

/** Separa "Status Ing OOCC" en la etapa y la disciplina que revisa. */
function partirEncabezadoDeEstado(
  encabezado: string,
  disciplinas: ReadonlySet<string>,
): { etapa: string; revision: string | null } | null {
  const sinPrefijo = encabezado.replace(RE_ESTADO, '').trim()
  if (sinPrefijo === '') return null
  const tokens = sinPrefijo.split(/\s+/)
  if (tokens.length >= 2) {
    const cola = normalizarTexto(tokens[tokens.length - 1]!)
    if (disciplinas.has(cola)) {
      return {
        etapa: nombreEtapa(tokens.slice(0, -1).join(' ')),
        revision: DISCIPLINAS_CONOCIDAS[cola] ?? tokens[tokens.length - 1]!,
      }
    }
  }
  return { etapa: nombreEtapa(sinPrefijo), revision: null }
}

/**
 * La etapa que menciona un encabezado cualquiera, si menciona alguna.
 *
 * Cuando menciona dos, gana la que no sea tambien una disciplina. "Comentarios
 * Ing OOCC" nombra Ingenieria y OOCC, y las dos pueden ser etapas en el mismo
 * tracker (OOCC lo es cuando existe "Estado OOCC", las obras civiles como fase
 * de obra). Pero en ese encabezado OOCC es quien revisa, no la etapa: la columna
 * es de Ingenieria.
 */
function etapaMencionada(
  encabezado: string,
  etapas: readonly string[],
  disciplinas: ReadonlySet<string> = new Set(),
): string | null {
  const texto = normalizarTexto(encabezado)
  const calzan = etapas.filter((etapa) =>
    tokensDeEtapa(etapa).some((token) =>
      calzaPalabra(texto, token),
    ),
  )
  if (calzan.length === 0) return null
  // Se mira cada forma de nombrar la etapa, no solo el nombre bueno: la etapa
  // "Construcción" se escribe "OOCC", que tambien es una disciplina.
  const noDisciplinas = calzan.filter(
    (e) => !tokensDeEtapa(e).some((token) => disciplinas.has(token)),
  )
  const candidatas = noDisciplinas.length > 0 ? noDisciplinas : calzan
  return candidatas.reduce((a, b) =>
    normalizarTexto(b).length > normalizarTexto(a).length ? b : a,
  )
}

function rolDe(encabezado: string, tipo: TipoCampo): RolColumna {
  if (RE_ESTADO.test(encabezado)) return 'estado'
  // El tipo manda sobre el encabezado: "Ing Fecha de Aprobación/Obs RF" dice
  // "Obs" pero es la fecha de la respuesta, no el comentario.
  if (tipo === 'fecha') return 'fecha'
  if (tipo === 'semana') return 'semana'
  if (RE_COMENTARIO.test(encabezado)) return 'comentario'
  return 'atributo'
}

/**
 * A que etapa pertenece cada columna.
 *
 * Primero por lo explicito: una columna "Status Ing OOCC" o "Presentación
 * Ingeniería" nombra su etapa. Pero la mayoria no la nombra: "Fecha Máxima
 * Respuesta", "SLA Revisión2", "Comentarios OOCC" se entienden solo por donde
 * estan. En estos archivos cada etapa ocupa un bloque contiguo de columnas, asi
 * que la posicion resuelve el resto:
 *
 * - Un hueco DENTRO del bloque de una etapa es de esa etapa.
 * - Un hueco ENTRE dos bloques es de la etapa que viene despues: son las
 *   columnas de preparacion (presentacion, envio, SLA) del paso siguiente.
 * - Lo que va antes del primer bloque son atributos del sitio, y lo que va
 *   despues del ultimo son columnas de gestion. Ni una cosa ni la otra es de
 *   una etapa, y forzarlas seria inventar.
 */
function asignarColumnasAEtapas(
  encabezados: readonly string[],
  nombresEtapa: readonly string[],
  disciplinas: ReadonlySet<string>,
  identidad: ReadonlySet<number>,
): Map<number, string> {
  const asignadas = new Map<number, string>()

  // Una etapa ocupa un BLOQUE de columnas contiguas. Si el nombre de una etapa
  // aparece repartido por todo el ancho del archivo, ese nombre es una palabra
  // comun y no un marcador de etapa: "Sitio" sale en "ID Sitio" (columna 1) y en
  // "Fecha Sitio On Air" (columna 125), y arrastraria el tracker entero a una
  // sola etapa. Lo mismo "Adecuaciones", con una mencion suelta en la 10 y su
  // "Estado" en la 79.
  //
  // Se mide la dispersion y no la cantidad: en un tracker de ciento cuarenta
  // columnas, TSS aparece diecisiete veces y es perfectamente fiable, porque
  // esas diecisiete estan juntas.
  const ancho = Math.max(encabezados.length, 1)
  const fiables = nombresEtapa.filter((nombre) => {
    const indices = encabezados
      .map((enc, i) =>
        enc !== '' && !identidad.has(i) && etapaMencionada(enc, [nombre]) !== null ? i : -1,
      )
      .filter((i) => i >= 0)
    if (indices.length < 3) return true
    const dispersion = (indices[indices.length - 1]! - indices[0]!) / ancho
    return dispersion <= 0.5
  })

  encabezados.forEach((enc, i) => {
    if (enc === '' || identidad.has(i) || RE_ESTADO_SITIO.test(enc)) return
    const explicita = RE_ESTADO.test(enc)
      ? (partirEncabezadoDeEstado(enc, disciplinas)?.etapa ?? null)
      : etapaMencionada(enc, fiables, disciplinas)
    if (explicita !== null) asignadas.set(i, explicita)
  })

  // El rango de una etapa se ancla SOLO en sus columnas "Status", que van
  // siempre juntas. Si se anclara tambien en las menciones, a "Adecuaciones" le
  // bastaria una mencion suelta en la columna 10 y su "Estado" en la 79 para
  // reclamar las sesenta y ocho columnas del medio, que son de otras etapas.
  const rangos = new Map<string, { min: number; max: number }>()
  encabezados.forEach((enc, i) => {
    if (enc === '' || !RE_ESTADO.test(enc) || RE_ESTADO_SITIO.test(enc)) return
    const etapa = partirEncabezadoDeEstado(enc, disciplinas)?.etapa
    if (etapa === undefined) return
    const r = rangos.get(etapa)
    if (r === undefined) rangos.set(etapa, { min: i, max: i })
    else rangos.set(etapa, { min: Math.min(r.min, i), max: Math.max(r.max, i) })
  })
  const ordenados = [...rangos.entries()].sort((a, b) => a[1].min - b[1].min)
  if (ordenados.length === 0) return asignadas

  encabezados.forEach((enc, i) => {
    if (enc === '' || asignadas.has(i) || identidad.has(i)) return
    const dentro = ordenados.find(([, r]) => i > r.min && i < r.max)
    if (dentro !== undefined) {
      asignadas.set(i, dentro[0])
      return
    }
    const siguiente = ordenados.find(([, r]) => i < r.min)
    const primero = ordenados[0]![1]
    // Solo se rellena entre bloques, nunca antes del primero.
    if (siguiente !== undefined && i > primero.min) asignadas.set(i, siguiente[0])
  })

  return asignadas
}

/**
 * Propone una plantilla completa a partir de las filas crudas de una hoja.
 * No escribe nada: devuelve la propuesta para que alguien la revise.
 */
export function inferirPlantilla(
  filas: readonly unknown[][],
  opciones: { filaEncabezado?: number; maximoEjemplos?: number } = {},
): PlantillaInferida {
  const avisos: string[] = []
  const filaEncabezado = opciones.filaEncabezado ?? detectarFilaEncabezado(filas)
  const maximoEjemplos = opciones.maximoEjemplos ?? 3

  const encabezados = (filas[filaEncabezado] ?? []).map((c) =>
    c === null || c === undefined ? '' : String(c).trim(),
  )
  const datos = filas
    .slice(filaEncabezado + 1)
    .filter((f) => f.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))

  if (datos.length === 0) avisos.push('La hoja no tiene filas de datos bajo el encabezado.')

  // 1. Vocabulario de disciplinas: la semilla mas lo que el archivo demuestre.
  //    Un token cuenta como disciplina si cierra columnas "Status" de dos etapas
  //    distintas; con una sola podria ser parte del nombre de la etapa.
  const colasPorToken = new Map<string, Set<string>>()
  encabezados.forEach((enc) => {
    if (!RE_ESTADO.test(enc)) return
    const tokens = enc.replace(RE_ESTADO, '').trim().split(/\s+/)
    if (tokens.length < 2) return
    const cola = normalizarTexto(tokens[tokens.length - 1]!)
    const cabeza = normalizarTexto(tokens.slice(0, -1).join(' '))
    if (!colasPorToken.has(cola)) colasPorToken.set(cola, new Set())
    colasPorToken.get(cola)!.add(cabeza)
  })
  const disciplinas = new Set(Object.keys(DISCIPLINAS_CONOCIDAS))
  for (const [token, cabezas] of colasPorToken) {
    if (cabezas.size >= 2) disciplinas.add(token)
  }

  // 2. Etapas y sus revisiones, desde las columnas de estado. El orden de
  //    aparicion de izquierda a derecha es el orden del proceso.
  const etapasPorNombre = new Map<string, { orden: number; revisiones: Map<string, string> }>()
  encabezados.forEach((enc, i) => {
    if (enc === '' || !RE_ESTADO.test(enc) || RE_ESTADO_SITIO.test(enc)) return
    const partido = partirEncabezadoDeEstado(enc, disciplinas)
    if (partido === null) return
    if (!etapasPorNombre.has(partido.etapa)) {
      etapasPorNombre.set(partido.etapa, { orden: i, revisiones: new Map() })
    }
    if (partido.revision !== null) {
      etapasPorNombre
        .get(partido.etapa)!
        .revisiones.set(idUnico(partido.revision, new Set()), partido.revision)
    }
  })

  // El hito On Air no viene como "Status": viene como "Sitios On air" y "Fecha
  // Sitio On Air". Cuando esta, es el ultimo paso del proceso.
  const indiceOnAir = encabezados.findIndex((enc) => RE_ON_AIR.test(normalizarTexto(enc)))
  const indiceFechaOnAir = encabezados.findIndex((enc) =>
    RE_FECHA_ON_AIR.test(normalizarTexto(enc)),
  )
  const conOnAir = (indiceOnAir >= 0 || indiceFechaOnAir >= 0) && !etapasPorNombre.has(ETAPA_ON_AIR)
  if (conOnAir) {
    etapasPorNombre.set(ETAPA_ON_AIR, {
      orden: Number.MAX_SAFE_INTEGER,
      revisiones: new Map(),
    })
  }

  const etapas: EtapaInferida[] = [...etapasPorNombre.entries()]
    .sort((a, b) => a[1].orden - b[1].orden)
    .map(([nombre, datosEtapa], orden) => ({
      id: idUnico(nombre, new Set()),
      nombre,
      orden,
      tipo: tipoPropuestoDeEtapa(nombre, datosEtapa.revisiones.size > 0),
      revisiones: [...datosEtapa.revisiones.entries()].map(([id, nom]) => ({ id, nombre: nom })),
      ...(nombre === ETAPA_ON_AIR && conOnAir ? { cierraConFecha: true } : {}),
    }))

  if (etapas.length === 0) {
    avisos.push(
      'No se reconocieron etapas: no hay columnas que empiecen con "Status" o "Estado". ' +
        'Las columnas se importan igual como campos, y las etapas se pueden definir a mano.',
    )
  }

  // 3. Identidad.
  const identidad: Partial<Record<ClaveIdentidad, number>> = {}
  for (const [clave, alias] of Object.entries(ALIAS_IDENTIDAD) as [
    ClaveIdentidad,
    readonly string[],
  ][]) {
    const i = encabezados.findIndex((enc) => enc !== '' && alias.includes(normalizarTexto(enc)))
    if (i >= 0) identidad[clave] = i
  }
  // 3b. Condicion del sitio: vigencia, fase (con sus On Hold) y el estado
  //     consolidado. No son identidad (se guardan igual como campos), pero la
  //     importacion las lee aparte.
  const condicion: CondicionInferida = {}
  const buscar = (alias: readonly string[]) =>
    encabezados.findIndex((enc) => enc !== '' && alias.includes(normalizarTexto(enc)))
  const iVigencia = buscar(ALIAS_VIGENCIA)
  if (iVigencia >= 0) condicion.vigencia = iVigencia
  const iFase = buscar(ALIAS_FASE)
  if (iFase >= 0) condicion.fase = iFase
  const iEstadoSitio = encabezados.findIndex((enc) => enc !== '' && RE_ESTADO_SITIO.test(enc))
  if (iEstadoSitio >= 0) condicion.estadoSitio = iEstadoSitio

  for (const obligatoria of ['id', 'nombre'] as const) {
    if (identidad[obligatoria] === undefined) {
      avisos.push(
        `No se encontró la columna de ${obligatoria === 'id' ? 'ID de sitio' : 'nombre'}; hay que elegirla a mano.`,
      )
    }
  }

  // 4. Una definición de campo por columna.
  const nombresEtapa = etapas.map((e) => e.nombre)
  const idsTomados = new Set<string>()
  const indicesIdentidad = new Set(Object.values(identidad))
  const etapaPorColumna = asignarColumnasAEtapas(
    encabezados,
    nombresEtapa,
    disciplinas,
    indicesIdentidad,
  )
  const columnas: ColumnaInferida[] = []

  encabezados.forEach((enc, i) => {
    if (enc === '') return
    const valores = datos.map((f) => f[i] ?? null)
    const llenos = valores.filter((v) => v !== null && String(v).trim() !== '')
    if (llenos.length === 0) return // columna vacía: no se propone

    const inferido = inferirTipo(enc, valores)
    let tipo = inferido.tipo
    let ops = inferido.opciones
    const id = idUnico(enc, idsTomados)
    idsTomados.add(id)

    const esOnAir = conOnAir && (i === indiceOnAir || i === indiceFechaOnAir)
    let etapa = indicesIdentidad.has(i) ? null : (etapaPorColumna.get(i) ?? null)
    if (esOnAir) etapa = ETAPA_ON_AIR
    else if (etapa === ETAPA_ON_AIR) etapa = null
    if (i === condicion.estadoSitio || i === condicion.vigencia) etapa = null

    const revision =
      RE_ESTADO.test(enc) && i !== condicion.estadoSitio
        ? (partirEncabezadoDeEstado(enc, disciplinas)?.revision ?? null)
        : null

    let rol: RolColumna = indicesIdentidad.has(i) ? 'identidad' : rolDe(enc, tipo)
    if (i === condicion.estadoSitio) {
      rol = 'estadoSitio'
      // Se guarda como lista de opciones: su texto ("En Construcción 4G") no es
      // un estado de revision y clasificarlo como tal no diria nada.
      tipo = 'opcion'
      ops = [...new Set(llenos.map((v) => String(v).trim()))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      )
    } else if (i === condicion.vigencia) {
      rol = 'vigencia'
    } else if (esOnAir && i === indiceOnAir) {
      // "Sitios On air" es el estado consolidado de la etapa On Air.
      rol = 'estado'
      tipo = 'estado'
      ops = [...new Set(llenos.map((v) => String(v).trim()))].sort()
    } else if (esOnAir) {
      rol = 'fecha'
    }
    const noConvertibles = llenos.filter((v) => !coercionar(tipo, v).ok).length

    columnas.push({
      indice: i,
      encabezado: enc,
      campo: {
        id,
        nombre: enc,
        tipo,
        grupo: etapa ?? (rol === 'identidad' ? 'Identificación' : 'General'),
        opciones: ops,
        // Con ciento cuarenta columnas, mostrarlas todas no es una tabla. Entran
        // las de estado, que es lo que se mira a diario.
        enTabla: rol === 'estado' && revision === null,
        origen: enc,
      },
      etapa,
      revision,
      rol,
      llenado: llenos.length / Math.max(datos.length, 1),
      ejemplos: [...new Set(llenos.map((v) => String(v).trim().slice(0, 60)))].slice(
        0,
        maximoEjemplos,
      ),
      noConvertibles,
    })
  })

  // El aviso sobre celdas que no calzan con su tipo NO se agrega aqui a
  // proposito: el tipo se puede corregir en la pantalla de revision, y un aviso
  // congelado al momento de inferir seguiria nombrando una columna ya
  // arreglada. Se deriva de `columnas` donde se muestra.

  return { filaEncabezado, etapas, columnas, identidad, condicion, avisos }
}
