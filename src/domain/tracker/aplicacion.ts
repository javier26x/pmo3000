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
import type { TipoEtapa } from '@/domain/gates/catalogo'
import { coercionar, type ValorCampo } from './campos'
import {
  clasificarEstado,
  combinarTecnologias,
  corregirErratas,
  estaCerrado,
  estadoResumen,
  esFechaDeEstado,
  normalizarTexto,
  tecnologiaDe,
  type EstadoSemantico,
  type Tecnologia,
} from './estados'
import {
  calzaPalabra,
  type ColumnaInferida,
  type EtapaInferida,
  type PlantillaInferida,
} from './inferencia'
import { condicionDelSitio, type CondicionSitio } from './estadoSitio'

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
  /** Nombre visible de la etapa. Ausente en filas armadas a mano (pruebas). */
  nombre?: string
  /** Ausente equivale a secuencial. Una paralela nunca es la etapa actual. */
  tipo?: TipoEtapa
  /** Lo que dicen las revisiones juntas: sirve para ver quien frena. */
  resumen: EstadoSemantico
  /** El veredicto propio del tracker, si la etapa trae columna consolidada. */
  consolidado: EstadoSemantico | null
  cerrada: boolean
  /** La fecha mas tardia de sus revisiones: cuando termino de moverse. */
  fecha: FechaISO | null
  revisiones: Record<string, RevisionDeFila>
}

/** Lo que la lectura de la fila tuvo que arreglar o no pudo leer. */
export interface CalidadDeFila {
  /** Celdas de estado cuya clasificacion necesito corregir una errata. */
  corregidas: number
  /** Celdas de estado con "0": formula sobre una celda vacia, sin dato. */
  ceros: number
  /** Celdas de estado que traian una fecha en vez de un texto. */
  fechas: number
}

export interface FilaTracker {
  sitio: SitioDeFila
  valores: Record<string, ValorCampo>
  etapas: EtapaDeFila[]
  /** Primera etapa SECUENCIAL no cerrada, o CERRADO si todas lo estan. */
  etapaActual: string
  problemas: string[]
  /** Vigencia y bloqueo que trae el tracker. Ausente en filas armadas a mano. */
  condicion?: CondicionSitio
  /** Texto de la columna consolidada del tracker ("Status Sitio"), si la hay. */
  estadoSitioTracker?: string | null
  /** 4G, 4G/5G, 5G o Indoor, segun los estados consolidados de las etapas. */
  tecnologia?: Tecnologia | null
  calidad?: CalidadDeFila
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
  /**
   * Fecha propia de la etapa, sin disciplina ("Fecha Sitio On Air"). Solo se
   * usa en las etapas que cierran con fecha (EtapaInferida.cierraConFecha).
   */
  fechaEtapa: Map<string, number>
  campos: ColumnaInferida[]
}

function llave(etapa: string, revision: string): string {
  return `${etapa}\u0000${revision}`
}

function mencionaRevision(encabezado: string, revision: string): boolean {
  const limpio = encabezado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const token = revision.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return calzaPalabra(limpio, token)
}

export function indexarColumnas(plantilla: PlantillaInferida): IndiceColumnas {
  const indice: IndiceColumnas = {
    estados: new Map(),
    comentarios: new Map(),
    fechas: new Map(),
    resumenEtapa: new Map(),
    fechaEtapa: new Map(),
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
      if (
        etapa.cierraConFecha === true &&
        col.rol === 'fecha' &&
        !indice.fechaEtapa.has(etapa.nombre)
      ) {
        indice.fechaEtapa.set(etapa.nombre, col.indice)
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

  // Todo lo que no es identidad ni parte de una revision se guarda como valor
  // del sitio: los estados, comentarios y fechas de cada disciplina ya viajan
  // dentro de su revision. El estado CONSOLIDADO de una etapa ("Status TSS",
  // "Status FC") si se guarda: es lo que se mira a diario, y en una etapa sin
  // disciplinas (FC, contrato, DOM) es el unico registro de su estado.
  indice.campos = plantilla.columnas.filter(
    (c) =>
      c.rol !== 'identidad' &&
      !(c.rol === 'estado' && c.revision !== null) &&
      !esColumnaDeRevision(c, plantilla),
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

  const textoCondicion = (i: number | undefined) => textoDe(celda(i))
  const fase = textoCondicion(plantilla.condicion.fase)
  const tecnologiaFase = tecnologiaDe(fase)
  const exige5g = tecnologiaFase === '5G' || tecnologiaFase === '4G/5G'

  const calidad: CalidadDeFila = { corregidas: 0, ceros: 0, fechas: 0 }
  /** Texto de una celda de estado, contando de paso lo que hubo que arreglar. */
  const estadoDeCelda = (i: number | undefined): string => {
    const crudo = celda(i)
    if (crudo === null) return ''
    const conv = coercionar('estado', crudo)
    const texto = conv.ok && typeof conv.valor === 'string' ? conv.valor : textoDe(crudo)
    if (texto === '0') calidad.ceros++
    else if (esFechaDeEstado(crudo) || esFechaDeEstado(texto)) calidad.fechas++
    else if (corregirErratas(normalizarTexto(texto)).correcciones > 0) calidad.corregidas++
    return texto
  }

  // Etapas reabiertas porque su aprobado era solo 4G, y la ultima etapa
  // secuencial cerrada con 5G (ver la regla de tecnologia mas abajo).
  const reabiertasPor4g: number[] = []
  let ultimaCerrada5g = -1
  const etapas: EtapaDeFila[] = plantilla.etapas.map((etapa, indiceEtapa) => {
    const revisiones: Record<string, RevisionDeFila> = {}
    const clasificaciones: EstadoSemantico[] = []
    let fechaMaxima: FechaISO | null = null

    for (const revision of etapa.revisiones) {
      const k = llave(etapa.nombre, revision.nombre)
      const estado = estadoDeCelda(indice.estados.get(k))
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
    const crudoConsolidado = estadoDeCelda(indice.resumenEtapa.get(etapa.nombre))
    const consolidado =
      crudoConsolidado === '' ? null : clasificarEstado(crudoConsolidado, homologacion)

    // Para mostrar se usa el resumen de las revisiones cuando las hay: dice
    // QUIEN esta frenando, que es lo que el consolidado no dice.
    const resumen =
      clasificaciones.length > 0 ? estadoResumen(clasificaciones) : (consolidado ?? 'no_recibido')

    let cerrada = consolidado !== null ? estaCerrado(consolidado) : estaCerrado(resumen)

    // Un sitio de un proyecto 5G no cierra una etapa con un aprobado SOLO 4G:
    // "TSS Aprobado 4G" en un sitio del proyecto "5G" es el TSS del 4G que el
    // sitio ya tenia, y el de 5G sigue pendiente. Es lo que hace el tracker
    // Outdoor: 55 sitios 5G con "TSS Aprobado 4G" figuran "En Etapa de TSS".
    const tecnologiaEtapa = tecnologiaDe(crudoConsolidado)
    const soloPara4g = cerrada && exige5g && tecnologiaEtapa === '4G'
    if (soloPara4g) cerrada = false
    if (
      cerrada &&
      etapa.tipo !== 'paralela' &&
      (tecnologiaEtapa === '4G/5G' || tecnologiaEtapa === '5G')
    ) {
      ultimaCerrada5g = indiceEtapa
    }
    if (soloPara4g) reabiertasPor4g.push(indiceEtapa)

    // On Air: la fecha de salida al aire basta, aunque la celda de estado este
    // vacia. Y es la fecha de la etapa, que no tiene revisiones de donde sacarla.
    if (etapa.cierraConFecha === true) {
      const conv = coercionar('fecha', celda(indice.fechaEtapa.get(etapa.nombre)))
      const fechaPropia =
        conv.ok && typeof conv.valor === 'string' ? (conv.valor as FechaISO) : null
      if (fechaPropia !== null) {
        cerrada = true
        fechaMaxima = fechaPropia
      }
    }

    return {
      codigo: codigoDeEtapa(etapa),
      nombre: etapa.nombre,
      tipo: etapa.tipo,
      resumen,
      consolidado,
      cerrada,
      fecha: fechaMaxima,
      revisiones,
    }
  })

  // Si alguna etapa quedo aprobada para 5G ("Ing Aprobada 4G/5G"), el sitio ya
  // esta en su obra 5G: una etapa marcada "4G" con otra posterior cerrada es un
  // rotulo que nadie actualizo, no un pendiente. En el tracker Outdoor la PMO
  // da esos sitios por "On Air 4G/5G"; reabrirlas dejaba 80 sitios al aire
  // clasificados en TSS y otros en As Built.
  if (ultimaCerrada5g >= 0) {
    const ultimaCerrada = etapas.findLastIndex((e) => e.tipo !== 'paralela' && e.cerrada)
    for (const i of reabiertasPor4g) {
      const etapa = etapas[i]
      if (etapa && i < ultimaCerrada) etapa.cerrada = true
    }
  }

  const condicion = condicionDelSitio(textoCondicion(plantilla.condicion.vigencia), fase)
  const estadoSitioTracker =
    plantilla.condicion.estadoSitio === undefined
      ? null
      : textoCondicion(plantilla.condicion.estadoSitio) || null

  // La tecnologia sale de los consolidados de las etapas secuenciales ("Ing
  // Aprobada 4G/5G"), no del Status Sitio: ese se escribe a mano y es lo que se
  // quiere contrastar.
  const tecnologia = combinarTecnologias(
    plantilla.etapas
      .filter((e) => e.tipo !== 'paralela')
      .map((e) => tecnologiaDe(textoDe(celda(indice.resumenEtapa.get(e.nombre))))),
  )

  return {
    sitio,
    valores,
    etapas,
    etapaActual: primeraAbierta(etapas),
    problemas,
    condicion,
    estadoSitioTracker,
    tecnologia,
    calidad,
  }
}

/**
 * La etapa actual es la primera SECUENCIAL que no esta cerrada.
 *
 * Se recorre en orden y se devuelve la primera abierta, aunque mas adelante haya
 * otras cerradas: en un tracker real eso pasa (alguien aprueba el As Built antes
 * de que cierre la Ingenieria) y lo que frena al sitio es la que quedo atras.
 * Las paralelas (FC, contrato, DOM...) no cuentan: un contrato sin firmar no
 * deja al sitio "en contrato".
 */
export function primeraAbierta(etapas: readonly EtapaDeFila[]): string {
  return etapas.find((e) => e.tipo !== 'paralela' && !e.cerrada)?.codigo ?? CERRADO
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
    tipo: TipoEtapa
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
      tipo: etapa.tipo,
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
  // El enlace `siguiente` recorre solo las secuenciales: es la cadena que las
  // reglas usan para validar que un sitio avanza de a una etapa. Una paralela
  // no tiene siguiente y no es nunca el gate actual.
  const secuenciales = fila.etapas.filter((e) => e.tipo !== 'paralela').map((e) => e.codigo)

  fila.etapas.forEach((etapa, i) => {
    const paralela = etapa.tipo === 'paralela'
    const siguiente = paralela
      ? null
      : (secuenciales[secuenciales.indexOf(etapa.codigo) + 1] ?? null)
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
    // Una paralela abierta con algo registrado esta en curso: corre al lado.
    const paralelaEnCurso = paralela && Object.values(etapa.revisiones).some((r) => r.estado !== '')
    gates[etapa.codigo] = {
      orden: i,
      nombre: etapa.nombre ?? etapa.codigo,
      color: COLORES[i % COLORES.length] ?? 'gris',
      siguiente,
      tipo: paralela ? 'paralela' : 'secuencial',
      estado: etapa.cerrada
        ? 'completado'
        : esActual || paralelaEnCurso || (paralela && etapa.consolidado !== null)
          ? 'en_curso'
          : 'no_iniciado',
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
  // Solo entre secuenciales: un FC enviado o un contrato firmado "antes" de
  // tiempo no es desorden, es justamente lo que tiene de paralelo.
  const secuenciales = fila.etapas.filter((e) => e.tipo !== 'paralela')
  const i = secuenciales.findIndex((e) => e.codigo === fila.etapaActual)
  if (i < 0) return []
  return secuenciales
    .slice(i + 1)
    .filter((e) => e.cerrada)
    .map((e) => e.codigo)
}
