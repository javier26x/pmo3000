/**
 * Normalizacion de los estados de un tracker.
 *
 * En los trackers reales el estado de cada revision se escribe a mano, celda por
 * celda, durante anos y por mucha gente. Una sola columna trae "TSS Aprobado",
 * "TSS aprobado", "TSs Aprobado", "TSS Aprobado con Observaciones", "TSS
 * Aprobado (Adm)", "TSS Aprobado Indoor" y "TSS Aprobado 4G" conviviendo. Son el
 * mismo estado con distinta redaccion, y una app que los trate como siete
 * estados distintos no puede contar nada.
 *
 * La solucion tiene dos capas:
 *
 * 1. Una heuristica por palabras clave que clasifica el texto libre en un estado
 *    semantico. Cubre la mayoria sin configurar nada.
 * 2. Una tabla de homologacion por plantilla que manda sobre la heuristica. Es
 *    el reemplazo directo de la hoja "Homologacion Estados" que estos trackers
 *    ya traen: cuando el equipo usa una palabra propia, se agrega ahi y listo.
 *
 * Antes de la heuristica se corrigen las erratas contra un vocabulario corto
 * ("Finaliazada", "Apobada") y se reconocen las celdas que solo traen una fecha.
 *
 * El texto original NUNCA se pierde: se guarda tal cual y es lo que se muestra.
 * El estado semantico solo sirve para contar, colorear y calcular avance.
 */

export const ESTADOS_SEMANTICOS = [
  'no_aplica',
  'no_recibido',
  'en_revision',
  'observado',
  'rechazado',
  'detenido',
  'aprobado_con_obs',
  'aprobado',
  'desconocido',
] as const

export type EstadoSemantico = (typeof ESTADOS_SEMANTICOS)[number]

export const NOMBRES_ESTADO: Record<EstadoSemantico, string> = {
  no_aplica: 'No aplica',
  no_recibido: 'No recibido',
  en_revision: 'En revisión',
  observado: 'Observado',
  rechazado: 'Rechazado',
  detenido: 'Detenido',
  aprobado_con_obs: 'Aprobado con observaciones',
  aprobado: 'Aprobado',
  desconocido: 'Sin clasificar',
}

/** Color de la paleta con que se pinta cada estado. Ver styles/tokens.css. */
export const COLOR_ESTADO: Record<EstadoSemantico, string> = {
  no_aplica: 'gris',
  no_recibido: 'pizarra',
  en_revision: 'azul',
  observado: 'ambar',
  rechazado: 'rojo',
  detenido: 'naranja',
  aprobado_con_obs: 'lima',
  aprobado: 'esmeralda',
  desconocido: 'gris',
}

/**
 * Cuanto aporta cada estado al avance de una etapa, de 0 a 1. Un aprobado con
 * observaciones cuenta como cerrado porque deja pasar al sitio, pero no como un
 * aprobado limpio: la diferencia es justo lo que un tablero de PMO tiene que
 * mostrar. Lo que no aplica no entra en el calculo (ver avanceDeEtapa).
 */
const PESO: Record<EstadoSemantico, number> = {
  no_aplica: 0,
  no_recibido: 0,
  en_revision: 0.35,
  observado: 0.5,
  rechazado: 0,
  detenido: 0.2,
  aprobado_con_obs: 0.9,
  aprobado: 1,
  desconocido: 0,
}

/** Estados que dejan avanzar: la revision esta cerrada aunque tenga peros. */
export function estaCerrado(estado: EstadoSemantico): boolean {
  return estado === 'aprobado' || estado === 'aprobado_con_obs' || estado === 'no_aplica'
}

/** Estados que piden accion de alguien ahora mismo. */
export function pideAccion(estado: EstadoSemantico): boolean {
  return estado === 'observado' || estado === 'rechazado' || estado === 'detenido'
}

/** Minusculas, sin tildes y con los espacios colapsados. */
export function normalizarTexto(crudo: string): string {
  return crudo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// --------------------------------------------------------------- erratas

/**
 * Vocabulario canonico de los estados, para corregir erratas.
 *
 * En el tracker Outdoor real conviven "Finaliazada", "Termnaida", "Finallizadas",
 * "Apobada", "Rachazado", "Emviado", "Instadado" y "Obervaciones". Ninguna calza
 * con las reglas de mas abajo, y cada una deja a un sitio "sin clasificar" por
 * una tecla. Antes de aplicar las reglas, cada palabra que se parezca mucho a
 * una de esta lista (a una o dos letras de distancia) se reemplaza por ella.
 *
 * La lista es corta a proposito: solo las palabras que deciden un estado. Una
 * lista larga corrige de mas ("revisar" no es "revision").
 */
const VOCABULARIO = [
  'aprobada',
  'aprobado',
  'aprobadas',
  'aprobados',
  'finalizada',
  'finalizado',
  'finalizadas',
  'finalizados',
  'terminada',
  'terminado',
  'terminadas',
  'terminados',
  'rechazado',
  'rechazada',
  'enviado',
  'enviada',
  'instalado',
  'instalada',
  'recibido',
  'recibida',
  'observada',
  'observado',
  'observaciones',
  'observacion',
  'revision',
  'integrado',
  'firmado',
  'firmada',
] as const

const EN_VOCABULARIO: ReadonlySet<string> = new Set(VOCABULARIO)

/** Distancia de edicion con transposicion de vecinas (Damerau restringida). */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1
  const filas: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(filas[i - 1]![j]! + 1, filas[i]![j - 1]! + 1, filas[i - 1]![j - 1]! + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, filas[i - 2]![j - 2]! + 1)
      }
      filas[i]![j] = d
    }
  }
  return filas[a.length]![b.length]!
}

const CORRECCIONES = new Map<string, string | null>()

/** La palabra canonica mas cercana, o null si no hay una sola a distancia razonable. */
function corregirPalabra(palabra: string): string | null {
  if (palabra.length < 5 || EN_VOCABULARIO.has(palabra) || !/^[a-z]+$/.test(palabra)) return null
  // Un infinitivo no es una errata del participio: "Por integrar" no es
  // "integrado", y corregirlo convertiria un pendiente en un hecho.
  if (/(ar|er|ir)$/.test(palabra)) return null
  const cache = CORRECCIONES.get(palabra)
  if (cache !== undefined) return cache
  // Una letra de tolerancia en palabras cortas y dos en las largas: "apobada"
  // (7) esta a una de "aprobada", "termnaida" (9) esta a dos de "terminada".
  const tope = palabra.length >= 8 ? 2 : 1
  let mejor: string | null = null
  let mejorDistancia = tope + 1
  let empate = false
  for (const canonica of VOCABULARIO) {
    // La primera letra casi nunca es la errata, y exigirla evita saltos raros.
    if (canonica[0] !== palabra[0]) continue
    const d = distancia(palabra, canonica, tope)
    if (d < mejorDistancia) {
      mejor = canonica
      mejorDistancia = d
      empate = false
    } else if (d === mejorDistancia && d <= tope) {
      empate = true
    }
  }
  const resultado = mejorDistancia <= tope && !empate ? mejor : null
  CORRECCIONES.set(palabra, resultado)
  return resultado
}

/**
 * Texto normalizado con las erratas corregidas, y cuantas palabras se tocaron.
 * Es lo que usa clasificarEstado antes de aplicar las reglas; el conteo sirve
 * para el panel de calidad del archivo.
 */
export function corregirErratas(normalizado: string): { texto: string; correcciones: number } {
  let correcciones = 0
  const texto = normalizado.replace(/[a-z]+/g, (palabra) => {
    const corregida = corregirPalabra(palabra)
    if (corregida === null) return palabra
    correcciones++
    return corregida
  })
  return { texto, correcciones }
}

// --------------------------------------------------------------- fechas

const RE_FECHA_TEXTO = [
  /^\d{4}-\d{2}-\d{2}([t ][\d:.]+z?)?$/,
  /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/,
  // Lo que deja String(fecha) cuando una celda de fecha pasa por texto:
  // "Wed Sep 03 2025 00:00:00 GMT-0400 (hora estandar de Chile)".
  /^(mon|tue|wed|thu|fri|sat|sun) [a-z]{3} \d{1,2} \d{4}/,
]

/**
 * Si la celda de estado trae una fecha y nada mas.
 *
 * Pasa en el tracker real: 23 celdas de "Status FC" tienen la fecha en que se
 * envio el FC en vez de "FC Enviado". Una fecha en una celda de estado dice que
 * la cosa ocurrio ese dia, asi que se lee como aprobado.
 */
export function esFechaDeEstado(crudo: unknown): boolean {
  if (crudo instanceof Date) return !Number.isNaN(crudo.getTime())
  if (typeof crudo !== 'string') return false
  const t = normalizarTexto(crudo)
  return RE_FECHA_TEXTO.some((re) => re.test(t))
}

// --------------------------------------------------------------- reglas

/**
 * Reglas en orden: la primera que calza gana. El orden importa mas que las
 * reglas mismas. "no recibido" contiene "recibido", "aprobado con observaciones"
 * contiene "aprobado" y "observaciones", y "no aplica" puede aparecer dentro de
 * casi cualquier frase: por eso lo excluyente va primero y lo generico al final.
 */
const REGLAS: { estado: EstadoSemantico; prueba: (t: string) => boolean }[] = [
  // "0" NO es "no aplica": en estos trackers es lo que deja una formula sobre
  // una celda vacia (362 celdas de "Estado OOCC" en el tracker Outdoor). Leerlo
  // como cerrado daba por terminadas obras que nadie registro. Es falta de dato.
  { estado: 'no_recibido', prueba: (t) => t === '0' },
  { estado: 'no_aplica', prueba: (t) => t === '-' || /\bno\s+aplica\b/.test(t) },
  // "Contrato Post RFI": el contrato se firma despues del RFI por acuerdo. No
  // falta nada ahora, asi que no debe frenar ni contar como pendiente.
  { estado: 'no_aplica', prueba: (t) => /\bpost rfi\b/.test(t) },
  { estado: 'detenido', prueba: (t) => /detenid|on hold|congelad|paraliz/.test(t) },
  { estado: 'rechazado', prueba: (t) => /rechaz|\bnok\b|no aprobad/.test(t) },
  // Un aprobado que ademas menciona observaciones es aprobado con peros, no
  // observado: el sitio sigue avanzando. El caso inverso (observado sin
  // aprobacion) cae en la regla siguiente.
  {
    estado: 'aprobado_con_obs',
    prueba: (t) => /aprobad/.test(t) && /observ|\bobs\b|\(adm\)/.test(t),
  },
  { estado: 'observado', prueba: (t) => /observ/.test(t) },
  {
    estado: 'no_recibido',
    prueba: (t) => /no recibid|no entregad|no enviad|no iniciad|no firmad/.test(t),
  },
  // "En Etapa de TSS 4G", "En Implementacion 4G": la columna consolidada del
  // sitio dice en que etapa va, no si algo se aprobo.
  { estado: 'en_revision', prueba: (t) => /^en (etapa|implementacion|construccion)/.test(t) },
  { estado: 'no_recibido', prueba: (t) => /off air|sin energia|sin contrato/.test(t) },
  {
    estado: 'en_revision',
    prueba: (t) =>
      /revision|revisar|en proceso|iniciad|en ejecucion|en curso|evaluad|solicitad|en diseno|prefactibilidad|energia provisoria/.test(
        t,
      ),
  },
  // "FC Enviado a OOII" es el FC entregado: en el tracker Outdoor es el estado
  // final del FC (1.019 sitios), y el pendiente se escribe "Pendiente FC" o "FC
  // No Enviado". Por eso enviado y entregado cuentan como hecho.
  {
    estado: 'aprobado',
    prueba: (t) =>
      /aprobad|finalizad|firmad|integrad|instalad|conectad|recibid|entregad|enviad|on air|\bok\b|\bsi\b|terminad|construid|starlink/.test(
        t,
      ),
  },
  {
    estado: 'no_recibido',
    prueba: (t) => /pendiente|\bpdte\b|\btbd\b|por definir|sin |espera/.test(t),
  },
  // Columnas de si/no ("Sitio Necesita Refuerzo?"): un "No" seco significa que
  // el paso no corresponde para este sitio.
  { estado: 'no_aplica', prueba: (t) => t === 'no' },
]

/**
 * Clasifica el texto de una celda de estado.
 *
 * `homologacion` es la tabla de la plantilla y manda sobre la heuristica: sus
 * llaves se comparan normalizadas, asi que da lo mismo como se hayan escrito.
 * Antes de las reglas se corrigen las erratas (ver corregirErratas), y una
 * celda que solo trae una fecha se lee como aprobada (ver esFechaDeEstado).
 */
export function clasificarEstado(
  crudo: unknown,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
): EstadoSemantico {
  if (crudo === null || crudo === undefined) return 'no_recibido'
  if (crudo instanceof Date) return esFechaDeEstado(crudo) ? 'aprobado' : 'no_recibido'
  const texto = normalizarTexto(String(crudo))
  if (texto === '') return 'no_recibido'

  for (const [llave, estado] of Object.entries(homologacion)) {
    if (normalizarTexto(llave) === texto) return estado
  }

  if (esFechaDeEstado(texto)) return 'aprobado'

  const corregido = corregirErratas(texto).texto
  for (const regla of REGLAS) {
    if (regla.prueba(corregido)) return regla.estado
  }
  return 'desconocido'
}

// --------------------------------------------------------------- tecnologia

export const TECNOLOGIAS = ['4G', '4G/5G', '5G', 'Indoor'] as const
export type Tecnologia = (typeof TECNOLOGIAS)[number]

/**
 * La tecnologia que nombra un estado: "Ing Aprobada 4G/5G", "TSS Aprobado
 * Indoor", "On Air 4G".
 *
 * El sufijo no es parte del estado: "Ing Aprobada 4G" e "Ing Aprobada 4G/5G"
 * son el mismo aprobado. Se separa para no perder el dato (sirve para contar
 * sitios por tecnologia) sin ensuciar la clasificacion.
 */
export function tecnologiaDe(texto: string | null | undefined): Tecnologia | null {
  if (texto === null || texto === undefined) return null
  const t = normalizarTexto(String(texto))
  const tiene4g = /\b4g\b/.test(t)
  const tiene5g = /\b5g\b/.test(t)
  if (tiene4g && tiene5g) return '4G/5G'
  if (tiene5g) return '5G'
  if (tiene4g) return '4G'
  if (/\bindoor\b/.test(t)) return 'Indoor'
  return null
}

/**
 * La tecnologia de un sitio a partir de varios estados. Manda la mas amplia:
 * si un estado dice 4G y otro 4G/5G, el sitio es 4G/5G. Indoor solo queda si
 * ningun estado nombra una generacion.
 */
export function combinarTecnologias(lista: readonly (Tecnologia | null)[]): Tecnologia | null {
  const hay = new Set(lista.filter((t): t is Tecnologia => t !== null))
  const con4g = hay.has('4G') || hay.has('4G/5G')
  const con5g = hay.has('5G') || hay.has('4G/5G')
  if (con4g && con5g) return '4G/5G'
  if (con5g) return '5G'
  if (con4g) return '4G'
  return hay.has('Indoor') ? 'Indoor' : null
}

/**
 * Avance de una etapa a partir de los estados de sus revisiones, de 0 a 1.
 *
 * Lo que no aplica se saca del divisor: una etapa con tres revisiones donde una
 * no corresponde se completa con las otras dos, no se queda en dos tercios para
 * siempre. Si TODAS no aplican, la etapa esta completa (no hay nada que hacer).
 */
export function avanceDeEtapa(estados: readonly EstadoSemantico[]): number {
  const cuentan = estados.filter((e) => e !== 'no_aplica')
  if (cuentan.length === 0) return estados.length === 0 ? 0 : 1
  const suma = cuentan.reduce((acc, e) => acc + PESO[e], 0)
  return suma / cuentan.length
}

/**
 * Estado que resume a un conjunto de revisiones. Es el peor caso relevante: si
 * algo esta rechazado la etapa esta rechazada, aunque el resto este aprobado.
 * Esa es la lectura que sirve para priorizar.
 */
export function estadoResumen(estados: readonly EstadoSemantico[]): EstadoSemantico {
  const cuentan = estados.filter((e) => e !== 'no_aplica')
  if (cuentan.length === 0) return estados.length === 0 ? 'no_recibido' : 'no_aplica'
  for (const critico of ['rechazado', 'detenido', 'observado'] as const) {
    if (cuentan.includes(critico)) return critico
  }
  if (cuentan.every((e) => e === 'aprobado')) return 'aprobado'
  if (cuentan.every(estaCerrado)) return 'aprobado_con_obs'
  if (cuentan.some((e) => e === 'en_revision' || estaCerrado(e))) return 'en_revision'
  if (cuentan.every((e) => e === 'desconocido')) return 'desconocido'
  return 'no_recibido'
}
