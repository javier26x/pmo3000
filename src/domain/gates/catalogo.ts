/**
 * Catalogo de etapas del despliegue.
 *
 * El ORDEN es la regla de negocio central: un sitio no salta etapas. Lo que NO
 * es regla de negocio es cuales son las etapas. Dos trackers reales de la misma
 * PMO tienen procesos distintos —uno va TSS, FC, Ingenieria, As Built, IPRAN; el
 * otro suma Contrato, DOM y Transmision— y ninguno de los dos usa la secuencia
 * de siete que traia este archivo cableada.
 *
 * Por eso el codigo de etapa es un string libre: lo define la plantilla del
 * programa. Lo que sigue aca son las funciones que operan sobre una secuencia,
 * recibida como parametro, y la plantilla estandar que se ofrece como punto de
 * partida a quien no tiene un tracker propio.
 *
 * De donde sale la secuencia, segun el caso:
 *
 * - Mirando UN sitio: del propio documento, que lleva el `orden` embebido en
 *   cada gate (ver secuenciaDeGates). No hace falta cargar la plantilla.
 * - Mirando MUCHOS sitios (embudo, kanban, filtros): de las plantillas, via
 *   useCatalogos().etapas.
 */

/** Codigo de etapa. Lo define la plantilla; es la clave en Firestore. */
export type CodigoGate = string

/** Estado terminal: el sitio completo la ultima etapa y salio del flujo. */
export const CERRADO = 'CERRADO'

/** Etapa actual de un sitio: un codigo de la plantilla, o CERRADO. */
export type GateActual = string

/**
 * Paleta de las etapas. Son nombres y no valores porque cada uno se resuelve a
 * un par fondo/texto distinto en claro y en oscuro, con contraste AA verificado
 * en ambos (ver styles/tokens.css).
 */
export const COLORES_GATE = [
  'pizarra',
  'ambar',
  'violeta',
  'azul',
  'cian',
  'lima',
  'esmeralda',
  'rosa',
  'naranja',
  'rojo',
  'gris',
] as const
export type ColorGate = (typeof COLORES_GATE)[number]

/** Color por defecto de la etapa n-esima, para que una plantilla nueva no salga gris. */
export function colorPorIndice(i: number): ColorGate {
  return COLORES_GATE[i % (COLORES_GATE.length - 1)] ?? 'gris'
}

export function esColorGate(valor: unknown): valor is ColorGate {
  return typeof valor === 'string' && (COLORES_GATE as readonly string[]).includes(valor)
}

/** Lo minimo que hay que saber de una etapa para mostrarla. */
export interface EtapaCatalogo {
  codigo: CodigoGate
  nombre: string
  descripcion: string
  color: ColorGate
  orden: number
}

export const ETAPA_CERRADO: EtapaCatalogo = {
  codigo: CERRADO,
  nombre: 'Cerrado',
  descripcion: 'El sitio completó la última etapa y salió del flujo.',
  color: 'gris',
  orden: Number.MAX_SAFE_INTEGER,
}

// ----------------------------------------------------------- sobre secuencias

/**
 * La secuencia que lleva un sitio, sacada de su propio documento.
 *
 * El `orden` va embebido en cada gate justamente para esto: la ficha de un sitio
 * se dibuja sin cargar la plantilla, y las reglas de Firestore validan la
 * secuencia sin un get() extra.
 */
export function secuenciaDeGates(
  gates: Readonly<Record<string, { orden: number } | undefined>>,
): CodigoGate[] {
  return Object.entries(gates)
    .filter((par): par is [string, { orden: number }] => par[1] !== undefined)
    .sort((a, b) => a[1].orden - b[1].orden)
    .map(([codigo]) => codigo)
}

/** Posicion en la secuencia; CERRADO va al final y lo desconocido, fuera. */
export function ordenGate(gate: GateActual, secuencia: readonly CodigoGate[]): number {
  if (gate === CERRADO) return secuencia.length
  return secuencia.indexOf(gate)
}

/** La etapa que sigue. Despues de la ultima viene CERRADO. */
export function siguienteGate(
  gate: GateActual,
  secuencia: readonly CodigoGate[],
): GateActual | null {
  if (gate === CERRADO) return null
  const i = secuencia.indexOf(gate)
  if (i < 0) return null
  return secuencia[i + 1] ?? CERRADO
}

export function gateAnterior(
  gate: GateActual,
  secuencia: readonly CodigoGate[],
): GateActual | null {
  if (gate === CERRADO) return secuencia[secuencia.length - 1] ?? null
  const i = secuencia.indexOf(gate)
  return i <= 0 ? null : (secuencia[i - 1] ?? null)
}

/** Etapas ya superadas por un sitio que esta en `gate`. */
export function gatesCompletados(gate: GateActual, secuencia: readonly CodigoGate[]): CodigoGate[] {
  const hasta = ordenGate(gate, secuencia)
  return hasta < 0 ? [] : secuencia.slice(0, hasta)
}

export function esGateActual(
  valor: unknown,
  secuencia: readonly CodigoGate[],
): valor is GateActual {
  return valor === CERRADO || (typeof valor === 'string' && secuencia.includes(valor))
}

// ------------------------------------------------------- plantilla estandar

/**
 * Secuencia que ofrece la app a quien no trae un tracker propio. Es un punto de
 * partida editable, no la verdad: el seed la usa y la pantalla de Configuracion
 * la crea con un clic.
 */
export const ETAPAS_ESTANDAR: readonly EtapaCatalogo[] = [
  {
    codigo: 'TSSR',
    nombre: 'TSSR',
    descripcion: 'Technical Site Survey Report: levantamiento tecnico del sitio aprobado.',
    color: 'pizarra',
    orden: 0,
  },
  {
    codigo: 'FC',
    nombre: 'FC',
    descripcion: 'Fin de construccion: obra civil y energia terminadas.',
    color: 'ambar',
    orden: 1,
  },
  {
    codigo: 'RFI',
    nombre: 'RFI',
    descripcion: 'Ready For Installation: sitio disponible para instalar equipamiento.',
    color: 'violeta',
    orden: 2,
  },
  {
    codigo: 'IMP',
    nombre: 'Implementacion',
    descripcion: 'Implementacion: instalacion e integracion del equipamiento.',
    color: 'azul',
    orden: 3,
  },
  {
    codigo: 'D1',
    nombre: 'D+1',
    descripcion: 'Verificacion a un dia de la puesta en servicio.',
    color: 'cian',
    orden: 4,
  },
  {
    codigo: 'D7',
    nombre: 'D+7',
    descripcion: 'Verificacion a siete dias de la puesta en servicio.',
    color: 'lima',
    orden: 5,
  },
  {
    codigo: 'SSV',
    nombre: 'SSV',
    descripcion: 'Single Site Verification: aceptacion final del sitio.',
    color: 'esmeralda',
    orden: 6,
  },
]

export const CODIGOS_ESTANDAR: readonly CodigoGate[] = ETAPAS_ESTANDAR.map((e) => e.codigo)

// ------------------------------------------------------------- presentacion

/**
 * Nombre visible de una etapa.
 *
 * Con el catalogo cargado devuelve el nombre de la plantilla; sin el, el codigo,
 * que es lo unico cierto. Nunca inventa: un codigo que no esta en el catalogo se
 * muestra tal cual en vez de desaparecer.
 */
export function nombreGate(gate: GateActual, etapas: readonly EtapaCatalogo[] = []): string {
  if (gate === CERRADO) return ETAPA_CERRADO.nombre
  return etapas.find((e) => e.codigo === gate)?.nombre ?? gate
}

export function descripcionGate(gate: GateActual, etapas: readonly EtapaCatalogo[] = []): string {
  if (gate === CERRADO) return ETAPA_CERRADO.descripcion
  return etapas.find((e) => e.codigo === gate)?.descripcion ?? ''
}

export function colorGate(gate: GateActual, etapas: readonly EtapaCatalogo[] = []): ColorGate {
  if (gate === CERRADO) return ETAPA_CERRADO.color
  return etapas.find((e) => e.codigo === gate)?.color ?? 'gris'
}

/** Clase CSS del par fondo/texto de la etapa. Ver styles/index.css. */
export function claseGate(gate: GateActual, etapas: readonly EtapaCatalogo[] = []): string {
  return `gate-${colorGate(gate, etapas)}`
}
