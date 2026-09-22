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

/**
 * Reglas en orden: la primera que calza gana. El orden importa mas que las
 * reglas mismas. "no recibido" contiene "recibido", "aprobado con observaciones"
 * contiene "aprobado" y "observaciones", y "no aplica" puede aparecer dentro de
 * casi cualquier frase: por eso lo excluyente va primero y lo generico al final.
 */
const REGLAS: { estado: EstadoSemantico; prueba: (t: string) => boolean }[] = [
  { estado: 'no_aplica', prueba: (t) => t === '-' || t === '0' || /\bno\s+aplica\b/.test(t) },
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
  { estado: 'no_recibido', prueba: (t) => /no recibid|no entregad|no enviad|no iniciad/.test(t) },
  // "FC Enviado a OOII" no es un FC aprobado: es un FC que salio de la PMO y
  // esta esperando respuesta. Lo mismo "Entregado a". Sin este caso, mas de mil
  // celdas de los trackers reales se leerian como cerradas sin estarlo.
  { estado: 'en_revision', prueba: (t) => /(enviad[oa]|entregad[oa]) a\b/.test(t) },
  // "En Etapa de TSS 4G", "En Implementacion 4G": la columna consolidada del
  // sitio dice en que etapa va, no si algo se aprobo.
  { estado: 'en_revision', prueba: (t) => /^en (etapa|implementacion|construccion)/.test(t) },
  { estado: 'no_recibido', prueba: (t) => /off air|sin energia|sin contrato/.test(t) },
  {
    estado: 'en_revision',
    prueba: (t) => /revision|en proceso|iniciad|en ejecucion|en curso|evaluad|solicitad/.test(t),
  },
  {
    estado: 'aprobado',
    prueba: (t) =>
      /aprobad|finalizad|firmad|integrad|instalad|conectad|recibid|entregad|on air|\bok\b|\bsi\b|terminad|construid/.test(
        t,
      ),
  },
  { estado: 'no_recibido', prueba: (t) => /pendiente|\bpdte\b|\btbd\b|por definir|sin /.test(t) },
  // Columnas de si/no ("Sitio Necesita Refuerzo?"): un "No" seco significa que
  // el paso no corresponde para este sitio.
  { estado: 'no_aplica', prueba: (t) => t === 'no' },
]

/**
 * Clasifica el texto de una celda de estado.
 *
 * `homologacion` es la tabla de la plantilla y manda sobre la heuristica: sus
 * llaves se comparan normalizadas, asi que da lo mismo como se hayan escrito.
 */
export function clasificarEstado(
  crudo: string | null | undefined,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
): EstadoSemantico {
  if (crudo === null || crudo === undefined) return 'no_recibido'
  const texto = normalizarTexto(String(crudo))
  if (texto === '') return 'no_recibido'

  for (const [llave, estado] of Object.entries(homologacion)) {
    if (normalizarTexto(llave) === texto) return estado
  }

  for (const regla of REGLAS) {
    if (regla.prueba(texto)) return regla.estado
  }
  return 'desconocido'
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
