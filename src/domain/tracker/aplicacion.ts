/**
 * De una fila del tracker a los documentos de la app.
 *
 * La inferencia (inferencia.ts) dice QUE tiene el archivo. Esto dice COMO se
 * guarda: que sitio, que valores, que revisiones, y —lo mas interesante— en que
 * etapa esta realmente el sitio.
 *
 * Esa ultima parte no viene escrita en el archivo. El tracker tiene una columna
 * "Status Sitio" que alguien mantiene a mano y que se desincroniza, pero tiene
 * tambien los estados reales de cada revision. La etapa actual se DEDUCE de
 * ellos: es la primera que todavia no esta cerrada. Asi el avance sale del
 * trabajo registrado y no de una columna resumen que nadie actualizo.
 */
import type { FechaISO } from '@/domain/fechas'
import { coercionar, type ValorCampo } from './campos'
import { clasificarEstado, estaCerrado, estadoResumen, type EstadoSemantico } from './estados'
import type { ColumnaInferida, EtapaInferida, PlantillaInferida } from './inferencia'

/** Un sitio del maestro, tal como sale de la fila. */
export interface SitioDeFila {
  id: string
  nombre: string
  region: string
  comuna: string
  direccion: string
  lat: number | null
  lon: number | null
}

export interface RevisionDeFila {
  estado: string
  comentario: string
  fecha: FechaISO | null
}

export interface EtapaDeFila {
  codigo: string
  /** Lo que dicen las revisiones juntas: sirve para ver quien frena. */
  resumen: EstadoSemantico
  /** El veredicto propio del tracker, si la etapa trae columna consolidada. */
  consolidado: EstadoSemantico | null
  cerrada: boolean
  /** La fecha mas tardia de sus revisiones: cuando termino de moverse. */
  fecha: FechaISO | null
  revisiones: Record<string, RevisionDeFila>
}

export interface FilaTracker {
  sitio: SitioDeFila
  valores: Record<string, ValorCampo>
  etapas: EtapaDeFila[]
  /** Primera etapa no cerrada, o CERRADO si todas lo estan. */
  etapaActual: string
  problemas: string[]
}

const CERRADO = 'CERRADO'

function textoDe(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function numeroDe(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  const n = Number(textoDe(valor).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Indexa las columnas por etapa y revision, una sola vez para todo el archivo.
 *
 * Dentro de una etapa, cada revision necesita tres columnas: su estado, su
 * comentario y su fecha. El estado lo trae "Status <etapa> <disciplina>". El
 * comentario y la fecha se reconocen por mencionar la misma disciplina dentro de
 * la misma etapa, que es exactamente como estan escritos en estos archivos
 * ("Comentarios Ing OOCC", "Ing Fecha de Aprobación/Obs OOCC").
 */
export interface IndiceColumnas {
  estados: Map<string, number>
  comentarios: Map<string, number>
  fechas: Map<string, number>
  /** Columna del estado consolidado de la etapa, si existe. */
  resumenEtapa: Map<string, number>
  campos: ColumnaInferida[]
}

function llave(etapa: string, revision: string): string {
  return `${etapa}\u0000${revision}`
}

function mencionaRevision(encabezado: string, revision: string): boolean {
  const limpio = encabezado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const token = revision.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(limpio)
}

export function indexarColumnas(plantilla: PlantillaInferida): IndiceColumnas {
  const indice: IndiceColumnas = {
    estados: new Map(),
    comentarios: new Map(),
    fechas: new Map(),
    resumenEtapa: new Map(),
    campos: [],
  }

  const porEtapa = new Map<string, ColumnaInferida[]>()
  for (const col of plantilla.columnas) {
    if (col.etapa === null) continue
    const lista = porEtapa.get(col.etapa) ?? []
    lista.push(col)
    porEtapa.set(col.etapa, lista)
  }

  for (const etapa of plantilla.etapas) {
    const columnas = porEtapa.get(etapa.nombre) ?? []

    for (const col of columnas) {
      if (col.rol === 'estado' && col.revision === null) {
        indice.resumenEtapa.set(etapa.nombre, col.indice)
      }
      if (col.rol === 'estado' && col.revision !== null) {
        indice.estados.set(llave(etapa.nombre, col.revision), col.indice)
      }
    }

    for (const revision of etapa.revisiones) {
      const k = llave(etapa.nombre, revision.nombre)
      const candidatas = columnas.filter((c) => mencionaRevision(c.encabezado, revision.nombre))
      const comentario = candidatas.find((c) => c.rol === 'comentario')
      const fecha = candidatas.find((c) => c.rol === 'fecha')
      if (comentario) indice.comentarios.set(k, comentario.indice)
      if (fecha) indice.fechas.set(k, fecha.indice)
    }
  }

  // Todo lo que no es estado ni identidad se guarda como valor del sitio: los
  // comentarios y las fechas de revision ya viajan dentro de su revision.
  indice.campos = plantilla.columnas.filter(
    (c) => c.rol !== 'identidad' && c.rol !== 'estado' && !esColumnaDeRevision(c, plantilla),
  )

  return indice
}

function esColumnaDeRevision(col: ColumnaInferida, plantilla: PlantillaInferida): boolean {
  if (col.etapa === null) return false
  if (col.rol !== 'comentario' && col.rol !== 'fecha') return false
  const etapa = plantilla.etapas.find((e) => e.nombre === col.etapa)
  if (etapa === undefined) return false
  return etapa.revisiones.some((r) => mencionaRevision(col.encabezado, r.nombre))
}

/** Codigo estable de una etapa, para usarlo como clave en Firestore. */
export function codigoDeEtapa(etapa: EtapaInferida): string {
  return etapa.id.toUpperCase().replace(/-/g, '_')
}

export function convertirFila(
  fila: readonly unknown[],
  plantilla: PlantillaInferida,
  indice: IndiceColumnas,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
): FilaTracker {
  const problemas: string[] = []
  const celda = (i: number | undefined) => (i === undefined ? null : (fila[i] ?? null))

  const sitio: SitioDeFila = {
    id: textoDe(celda(plantilla.identidad.id)),
    nombre: textoDe(celda(plantilla.identidad.nombre)),
    region: textoDe(celda(plantilla.identidad.region)),
    comuna: textoDe(celda(plantilla.identidad.comuna)),
    direccion: textoDe(celda(plantilla.identidad.direccion)),
    lat: numeroDe(celda(plantilla.identidad.lat)),
    lon: numeroDe(celda(plantilla.identidad.lon)),
  }

  const valores: Record<string, ValorCampo> = {}
  for (const col of indice.campos) {
    const r = coercionar(col.campo.tipo, fila[col.indice] ?? null)
    if (r.ok) valores[col.campo.id] = r.valor
    else problemas.push(`${col.encabezado}: ${r.motivo}`)
  }

  const etapas: EtapaDeFila[] = plantilla.etapas.map((etapa) => {
    const revisiones: Record<string, RevisionDeFila> = {}
    const clasificaciones: EstadoSemantico[] = []
    let fechaMaxima: FechaISO | null = null

    for (const revision of etapa.revisiones) {
      const k = llave(etapa.nombre, revision.nombre)
      const estado = textoDe(celda(indice.estados.get(k)))
      const comentario = textoDe(celda(indice.comentarios.get(k)))
      const crudoFecha = celda(indice.fechas.get(k))
      const conv = coercionar('fecha', crudoFecha)
      const fecha = conv.ok && typeof conv.valor === 'string' ? (conv.valor as FechaISO) : null
      if (fecha !== null && (fechaMaxima === null || fecha > fechaMaxima)) fechaMaxima = fecha

      revisiones[revision.id] = { estado, comentario, fecha }
      clasificaciones.push(clasificarEstado(estado, homologacion))
    }

    // El tracker trae su propia columna consolidada por etapa ("Status TSS",
    // "Status Ing"), que es el veredicto de la PMO. Cuando existe, MANDA sobre
    // la suma de las revisiones.
    //
    // Hace falta porque no todas las disciplinas opinan de todos los sitios:
    // MMOO revisa el 6% de los sitios del tracker Outdoor. Exigiendo que las
    // cinco revisiones de TSS cierren, el 95% de los sitios se quedaba en TSS
    // por una celda vacia, cuando la propia planilla los daba por aprobados.
    const crudoConsolidado = textoDe(celda(indice.resumenEtapa.get(etapa.nombre)))
    const consolidado =
      crudoConsolidado === '' ? null : clasificarEstado(crudoConsolidado, homologacion)

    // Para mostrar se usa el resumen de las revisiones cuando las hay: dice
    // QUIEN esta frenando, que es lo que el consolidado no dice.
    const resumen =
      clasificaciones.length > 0 ? estadoResumen(clasificaciones) : (consolidado ?? 'no_recibido')

    return {
      codigo: codigoDeEtapa(etapa),
      resumen,
      consolidado,
      cerrada: consolidado !== null ? estaCerrado(consolidado) : estaCerrado(resumen),
      fecha: fechaMaxima,
      revisiones,
    }
  })

  return { sitio, valores, etapas, etapaActual: primeraAbierta(etapas), problemas }
}

/**
 * La etapa actual es la primera que no esta cerrada.
 *
 * Se recorre en orden y se devuelve la primera abierta, aunque mas adelante haya
 * otras cerradas: en un tracker real eso pasa (alguien aprueba el As Built antes
 * de que cierre la Ingenieria) y lo que frena al sitio es la que quedo atras.
 */
export function primeraAbierta(etapas: readonly EtapaDeFila[]): string {
  return etapas.find((e) => !e.cerrada)?.codigo ?? CERRADO
}

// ------------------------------------------------- de la fila al documento

/**
 * La plantilla que se guarda, construida desde la propuesta ya revisada.
 *
 * Los codigos de etapa se derivan del nombre (TSS, INGENIERIA, AS_BUILT) y son
 * los que quedan como claves en Firestore: estables, legibles en la consola, y
 * distintos de los nombres visibles, que se pueden corregir sin migrar nada.
 */
export function construirPlantilla(
  propuesta: PlantillaInferida,
  datos: {
    id: string
    nombre: string
    descripcion: string
    version: number
    homologacion: Readonly<Record<string, EstadoSemantico>>
  },
): {
  id: string
  nombre: string
  descripcion: string
  version: number
  activo: boolean
  gates: {
    codigo: string
    nombre: string
    descripcion: string
    color: string
    orden: number
    slaDias: number
    checklist: never[]
    revisiones: { id: string; nombre: string; bloquea: boolean }[]
  }[]
  campos: ColumnaInferida['campo'][]
  homologacion: Record<string, EstadoSemantico>
} {
  const indice = indexarColumnas(propuesta)
  return {
    id: datos.id,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    version: datos.version,
    activo: true,
    gates: propuesta.etapas.map((etapa, i) => ({
      codigo: codigoDeEtapa(etapa),
      nombre: etapa.nombre,
      descripcion: '',
      color: COLORES[i % COLORES.length] ?? 'gris',
      orden: etapa.orden,
      // El tracker no declara SLA por etapa; queda en cero y se ajusta en la
      // pantalla de configuracion si la PMO lo define despues.
      slaDias: 0,
      checklist: [],
      revisiones: etapa.revisiones.map((r) => ({ id: r.id, nombre: r.nombre, bloquea: true })),
    })),
    campos: indice.campos.map((c) => c.campo),
    homologacion: { ...datos.homologacion },
  }
}

const COLORES = [
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
]

/**
 * El mapa de gates del documento de seguimiento, con lo que el tracker ya sabe.
 *
 * A diferencia de crearGatesDesdePlantilla, que arranca un sitio de cero, esto
 * parte de un historial: las revisiones ya tienen estado, comentario y fecha, y
 * las etapas superadas ya estan cerradas. El `siguiente` se llena igual, porque
 * es lo que las reglas del servidor usan para validar la secuencia.
 */
export function construirGates(
  fila: FilaTracker,
  opciones: { responsableUid: string | null; proveedorId: string | null },
): Record<string, Record<string, unknown>> {
  const gates: Record<string, Record<string, unknown>> = {}
  const codigos = fila.etapas.map((e) => e.codigo)

  fila.etapas.forEach((etapa, i) => {
    const revisiones: Record<string, unknown> = {}
    for (const [id, rev] of Object.entries(etapa.revisiones)) {
      revisiones[id] = {
        estado: rev.estado,
        comentario: rev.comentario,
        fecha: rev.fecha,
        por: null,
        en: null,
      }
    }

    const esActual = etapa.codigo === fila.etapaActual
    gates[etapa.codigo] = {
      orden: i,
      nombre: etapa.codigo,
      color: COLORES[i % COLORES.length] ?? 'gris',
      siguiente: codigos[i + 1] ?? null,
      estado: etapa.cerrada ? 'completado' : esActual ? 'en_curso' : 'no_iniciado',
      fechaPlan: null,
      // Una etapa cerrada tiene que traer fecha real: es lo que las reglas
      // exigen para dejar avanzar. Si el tracker no la trae, se deja la fecha
      // mas tardia de sus revisiones, y si tampoco hay, no se marca cerrada.
      fechaReal: etapa.cerrada ? etapa.fecha : null,
      fechaBaseline: null,
      responsableUid: opciones.responsableUid,
      proveedorId: opciones.proveedorId,
      checklist: {},
      revisiones,
      completadoEn: null,
      completadoPor: null,
    }
  })

  return gates
}

/**
 * Sitios cuyo avance va fuera de orden: hay etapas aprobadas DESPUES de la que
 * los tiene frenados. No es un error de la app sino un hallazgo del tracker, y
 * vale la pena decirlo al importar: suele ser una celda que nadie actualizo.
 */
export function avanceFueraDeOrden(fila: FilaTracker): string[] {
  const i = fila.etapas.findIndex((e) => e.codigo === fila.etapaActual)
  if (i < 0) return []
  return fila.etapas
    .slice(i + 1)
    .filter((e) => e.cerrada)
    .map((e) => e.codigo)
}
