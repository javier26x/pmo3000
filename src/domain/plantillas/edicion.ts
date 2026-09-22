/**
 * Edicion de plantillas de gates.
 *
 * Una plantilla se instancia (se copia) en cada seguimiento al crearlo, pero no
 * todo queda copiado: la maquina de gates vuelve a leer la plantilla VIGENTE
 * para saber que entregables exige cada etapa, y las vistas que cruzan programas
 * (embudo, kanban, filtros) sacan de ella el nombre y el color de las etapas.
 * Solo hay un documento por plantilla: la version sirve para saber con cual se
 * creo cada seguimiento, no para volver a leerla.
 *
 * De ahi la clasificacion de cambios que sigue:
 *
 * - Nombre, descripcion y color: solo presentacion. Seguros siempre.
 * - Quitar una etapa, o cambiar su codigo: los seguimientos que la tienen
 *   dejarian de poder avanzar ("el gate no existe en la plantilla"). Si hay
 *   seguimientos con la plantilla, se bloquea.
 * - Agregar o reordenar etapas, cambiar SLA: los seguimientos existentes
 *   conservan su propia secuencia y sus fechas plan; se aplica a los nuevos.
 * - Agregar un entregable obligatorio, o volver obligatorio uno que no lo era:
 *   los sitios que estan en esa etapa lo van a necesitar para avanzar. Se avisa.
 *
 * Todo aca es logica pura: la pantalla la usa para avisar y el repositorio para
 * volver a comprobar justo antes de escribir.
 */
import { CERRADO, COLORES_GATE, colorPorIndice } from '@/domain/gates/catalogo'
import { aTextoDeId } from '@/domain/tipos/identificadores'
import {
  esquemaGateTemplate,
  type GatePlantilla,
  type GateTemplate,
  type ItemPlantilla,
  type RevisionPlantilla,
} from '@/domain/tipos/gate'

/** Largo maximo de un codigo de etapa generado. Va en rutas de campo de Firestore. */
const MAXIMO_CODIGO = 16

// ------------------------------------------------------------- identificadores

/** Agrega _2, _3, ... hasta no chocar. Compara sin mayusculas. */
function unico(propuesto: string, usados: Iterable<string>, separador: string): string {
  const ocupados = new Set([...usados].map((u) => u.toLowerCase()))
  if (!ocupados.has(propuesto.toLowerCase())) return propuesto
  for (let i = 2; i < 1000; i += 1) {
    const candidato = `${propuesto}${separador}${i}`
    if (!ocupados.has(candidato.toLowerCase())) return candidato
  }
  return `${propuesto}${separador}${Date.now()}`
}

/**
 * Codigo para una etapa nueva, a partir de su nombre: "As Built" -> "AS_BUILT".
 *
 * El codigo es la clave del gate en cada seguimiento y se usa en rutas de campo
 * (`gates.AS_BUILT.estado`), asi que solo lleva A-Z, 0-9 y guion bajo, no empieza
 * con un digito y nunca es CERRADO, que es el estado terminal.
 */
export function codigoParaEtapa(nombre: string, usados: Iterable<string>): string {
  let base = aTextoDeId(nombre).toUpperCase().replace(/-/g, '_').slice(0, MAXIMO_CODIGO)
  base = base.replace(/_+$/g, '')
  if (base === '') base = 'ETAPA'
  if (/^[0-9]/.test(base)) base = `E_${base}`.slice(0, MAXIMO_CODIGO)
  return unico(base, [...usados, CERRADO], '_')
}

/** Id de un entregable nuevo: "tssr-informe-firmado". Unico dentro de la etapa. */
export function idParaItem(codigo: string, texto: string, usados: Iterable<string>): string {
  const cuerpo = aTextoDeId(texto).slice(0, 40).replace(/-+$/g, '') || 'item'
  return unico(`${codigo.toLowerCase()}-${cuerpo}`, usados, '-')
}

/** Id de una revision nueva: "ing-rf". Unico dentro de la etapa. */
export function idParaRevision(codigo: string, nombre: string, usados: Iterable<string>): string {
  const cuerpo = aTextoDeId(nombre).slice(0, 30).replace(/-+$/g, '') || 'revision'
  return unico(`${codigo.toLowerCase()}-${cuerpo}`, usados, '-')
}

// ------------------------------------------------------------------ borradores

/** Etapa vacia lista para agregar al final de la plantilla. */
export function etapaNueva(nombre: string, existentes: readonly GatePlantilla[]): GatePlantilla {
  return {
    codigo: codigoParaEtapa(
      nombre,
      existentes.map((g) => g.codigo),
    ),
    nombre,
    descripcion: '',
    color: colorPorIndice(existentes.length),
    orden: existentes.length,
    slaDias: 10,
    checklist: [],
    revisiones: [],
  }
}

export function itemNuevo(etapa: GatePlantilla, texto: string): ItemPlantilla {
  return {
    id: idParaItem(
      etapa.codigo,
      texto,
      etapa.checklist.map((i) => i.id),
    ),
    texto,
    obligatorio: true,
    requiereEvidencia: false,
  }
}

export function revisionNueva(etapa: GatePlantilla, nombre: string): RevisionPlantilla {
  return {
    id: idParaRevision(
      etapa.codigo,
      nombre,
      etapa.revisiones.map((r) => r.id),
    ),
    nombre,
    bloquea: true,
  }
}

/** Mueve la etapa `i` una posicion arriba (-1) o abajo (+1). Renumera `orden`. */
export function moverEtapa(
  gates: readonly GatePlantilla[],
  i: number,
  delta: -1 | 1,
): GatePlantilla[] {
  const j = i + delta
  if (i < 0 || i >= gates.length || j < 0 || j >= gates.length) return renumerar(gates)
  const copia = [...gates]
  const [etapa] = copia.splice(i, 1)
  if (etapa) copia.splice(j, 0, etapa)
  return renumerar(copia)
}

/** El orden de la lista es el orden de la secuencia: 0, 1, 2, ... */
export function renumerar(gates: readonly GatePlantilla[]): GatePlantilla[] {
  return gates.map((g, orden) => (g.orden === orden ? g : { ...g, orden }))
}

/** Plantilla nueva desde cero: una sola etapa, para que sea valida de entrada. */
export function plantillaEnBlanco(id: string, nombre: string): GateTemplate {
  return {
    id,
    nombre,
    descripcion: '',
    version: 1,
    activo: true,
    gates: [etapaNueva('Etapa 1', [])],
    campos: [],
    homologacion: {},
    creadoEn: null,
    creadoPor: null,
    actualizadoEn: null,
    actualizadoPor: null,
  }
}

/**
 * Copia de una plantilla con otro id. Arranca en la version 1: es otra
 * plantilla, sin seguimientos, y se puede editar con libertad.
 */
export function duplicarPlantilla(
  original: GateTemplate,
  id: string,
  nombre: string,
): GateTemplate {
  return {
    ...structuredClone(original),
    id,
    nombre,
    version: 1,
    activo: true,
    creadoEn: null,
    creadoPor: null,
    actualizadoEn: null,
    actualizadoPor: null,
  }
}

/**
 * Lo que se escribe: textos recortados, orden renumerado y la version siguiente.
 * La version sube solo si algo cambio; un guardado sin cambios no la toca.
 */
export function prepararGuardado(
  original: GateTemplate | null,
  editada: GateTemplate,
): GateTemplate {
  const limpia: GateTemplate = {
    ...editada,
    nombre: editada.nombre.trim(),
    descripcion: editada.descripcion.trim(),
    gates: renumerar(
      editada.gates.map((g) => ({
        ...g,
        nombre: g.nombre.trim(),
        descripcion: g.descripcion.trim(),
        checklist: g.checklist.map((i) => ({ ...i, texto: i.texto.trim() })),
        revisiones: g.revisiones.map((r) => ({ ...r, nombre: r.nombre.trim() })),
      })),
    ),
  }
  if (original === null) return { ...limpia, version: 1 }
  const cambio = hayCambios(analizarCambios(original, limpia))
  return { ...limpia, version: cambio ? original.version + 1 : original.version }
}

// ------------------------------------------------------------------ validacion

/**
 * Errores que impiden guardar, en frases que dicen que pasa y como arreglarlo.
 * Usa el esquema zod de la plantilla y agrega lo que el esquema no ve:
 * codigos y ids repetidos.
 */
export function validarPlantilla(p: GateTemplate): string[] {
  const errores: string[] = []

  if (p.nombre.trim() === '') errores.push('La plantilla no tiene nombre. Escribe uno.')
  if (p.gates.length === 0) errores.push('La plantilla no tiene etapas. Agrega al menos una.')

  const codigos = new Set<string>()
  p.gates.forEach((g, i) => {
    const cual = g.nombre.trim() ? `La etapa «${g.nombre.trim()}»` : `La etapa ${i + 1}`
    if (g.nombre.trim() === '') errores.push(`La etapa ${i + 1} no tiene nombre. Escribe uno.`)
    const clave = g.codigo.toLowerCase()
    if (codigos.has(clave)) {
      errores.push(`${cual} repite el código ${g.codigo}. Quítala y vuelve a agregarla.`)
    }
    codigos.add(clave)
    if (g.codigo === CERRADO) {
      errores.push(`${cual} usa el código reservado ${CERRADO}. Quítala y vuelve a agregarla.`)
    }
    if (!Number.isInteger(g.slaDias) || g.slaDias < 0) {
      errores.push(`${cual} tiene un SLA inválido. Usa un número entero de días, 0 o más.`)
    }
    if (!(COLORES_GATE as readonly string[]).includes(g.color)) {
      errores.push(`${cual} tiene un color desconocido. Elige uno de la paleta.`)
    }

    const items = new Set<string>()
    g.checklist.forEach((item, k) => {
      if (item.texto.trim() === '') {
        errores.push(`${cual}: el entregable ${k + 1} está vacío. Escríbelo o quítalo.`)
      }
      if (items.has(item.id)) errores.push(`${cual}: hay dos entregables con el id ${item.id}.`)
      items.add(item.id)
    })

    const revisiones = new Set<string>()
    g.revisiones.forEach((r, k) => {
      if (r.nombre.trim() === '') {
        errores.push(`${cual}: la revisión ${k + 1} no tiene nombre. Escríbelo o quítala.`)
      }
      if (revisiones.has(r.id)) errores.push(`${cual}: hay dos revisiones con el id ${r.id}.`)
      revisiones.add(r.id)
    })
  })

  // Lo que el esquema detecte y las reglas de arriba no hayan dicho ya.
  if (errores.length === 0) {
    const resultado = esquemaGateTemplate.safeParse(p)
    if (!resultado.success) {
      for (const problema of resultado.error.issues) {
        errores.push(
          `Dato inválido en ${problema.path.join('.') || 'la plantilla'}: ${problema.message}.`,
        )
      }
    }
  }

  return errores
}

// ----------------------------------------------------------- analisis de cambios

export interface CambioEtapa {
  codigo: string
  nombre: string
}

export interface CambiosPlantilla {
  nombre: boolean
  descripcion: boolean
  activo: boolean
  /** Paso de activa a inactiva. Activar nunca es riesgoso. */
  desactivada: boolean
  /** Solo presentacion: nombre, descripcion o color de una etapa. */
  etapasPresentacion: CambioEtapa[]
  etapasNuevas: CambioEtapa[]
  etapasQuitadas: CambioEtapa[]
  /** La secuencia de las etapas que siguen existiendo cambio de orden. */
  reordenada: boolean
  sla: CambioEtapa[]
  /** Entregables obligatorios nuevos, o que pasaron a ser obligatorios. */
  obligatoriosNuevos: (CambioEtapa & { texto: string })[]
  /** Entregables quitados, que dejaron de ser obligatorios o cuya evidencia cambio. */
  checklistOtros: (CambioEtapa & { texto: string })[]
  /** Entregables opcionales agregados, o cuyo texto cambio. */
  checklistMenores: (CambioEtapa & { texto: string })[]
  revisiones: (CambioEtapa & { nombreRevision: string })[]
}

function mismoOrden(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

export function analizarCambios(original: GateTemplate, editada: GateTemplate): CambiosPlantilla {
  const antes = new Map(original.gates.map((g) => [g.codigo, g]))
  const despues = new Map(editada.gates.map((g) => [g.codigo, g]))
  const ref = (g: GatePlantilla): CambioEtapa => ({ codigo: g.codigo, nombre: g.nombre })

  const cambios: CambiosPlantilla = {
    nombre: original.nombre.trim() !== editada.nombre.trim(),
    descripcion: original.descripcion.trim() !== editada.descripcion.trim(),
    activo: original.activo !== editada.activo,
    desactivada: original.activo && !editada.activo,
    etapasPresentacion: [],
    etapasNuevas: editada.gates.filter((g) => !antes.has(g.codigo)).map(ref),
    etapasQuitadas: original.gates.filter((g) => !despues.has(g.codigo)).map(ref),
    reordenada: false,
    sla: [],
    obligatoriosNuevos: [],
    checklistOtros: [],
    checklistMenores: [],
    revisiones: [],
  }

  const ordenar = (gates: readonly GatePlantilla[]) =>
    [...gates].sort((a, b) => a.orden - b.orden).map((g) => g.codigo)
  const comunes = (codigos: string[], otro: Map<string, GatePlantilla>) =>
    codigos.filter((c) => otro.has(c))
  cambios.reordenada = !mismoOrden(
    comunes(ordenar(original.gates), despues),
    comunes(ordenar(editada.gates), antes),
  )

  for (const nueva of editada.gates) {
    const vieja = antes.get(nueva.codigo)
    if (!vieja) continue
    const etapa = ref(nueva)

    if (
      vieja.nombre.trim() !== nueva.nombre.trim() ||
      vieja.descripcion.trim() !== nueva.descripcion.trim() ||
      vieja.color !== nueva.color
    ) {
      cambios.etapasPresentacion.push(etapa)
    }
    if (vieja.slaDias !== nueva.slaDias) cambios.sla.push(etapa)

    const itemsAntes = new Map(vieja.checklist.map((i) => [i.id, i]))
    const itemsDespues = new Map(nueva.checklist.map((i) => [i.id, i]))
    for (const item of nueva.checklist) {
      const previo = itemsAntes.get(item.id)
      const fila = { ...etapa, texto: item.texto }
      if (!previo) {
        ;(item.obligatorio ? cambios.obligatoriosNuevos : cambios.checklistMenores).push(fila)
      } else if (item.obligatorio && !previo.obligatorio) {
        cambios.obligatoriosNuevos.push(fila)
      } else if (
        previo.obligatorio !== item.obligatorio ||
        previo.requiereEvidencia !== item.requiereEvidencia
      ) {
        cambios.checklistOtros.push(fila)
      } else if (previo.texto.trim() !== item.texto.trim()) {
        cambios.checklistMenores.push(fila)
      }
    }
    for (const item of vieja.checklist) {
      if (!itemsDespues.has(item.id)) cambios.checklistOtros.push({ ...etapa, texto: item.texto })
    }

    const revAntes = new Map(vieja.revisiones.map((r) => [r.id, r]))
    const revDespues = new Map(nueva.revisiones.map((r) => [r.id, r]))
    for (const r of nueva.revisiones) {
      const previa = revAntes.get(r.id)
      if (!previa || previa.nombre.trim() !== r.nombre.trim() || previa.bloquea !== r.bloquea) {
        cambios.revisiones.push({ ...etapa, nombreRevision: r.nombre })
      }
    }
    for (const r of vieja.revisiones) {
      if (!revDespues.has(r.id)) cambios.revisiones.push({ ...etapa, nombreRevision: r.nombre })
    }
  }

  return cambios
}

export function hayCambios(c: CambiosPlantilla): boolean {
  return (
    c.nombre ||
    c.descripcion ||
    c.activo ||
    c.reordenada ||
    [
      c.etapasPresentacion,
      c.etapasNuevas,
      c.etapasQuitadas,
      c.sla,
      c.obligatoriosNuevos,
      c.checklistOtros,
      c.checklistMenores,
      c.revisiones,
    ].some((lista) => lista.length > 0)
  )
}

export interface Impacto {
  /** Lo que impide guardar. */
  bloqueos: string[]
  /** Lo que se puede guardar, pero conviene saber antes. */
  advertencias: string[]
}

const nombres = (etapas: readonly CambioEtapa[]) =>
  [...new Set(etapas.map((e) => `«${e.nombre}»`))].join(', ')

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * Que significa un conjunto de cambios, dado cuantos seguimientos usan la
 * plantilla. Sin seguimientos todo es seguro: la plantilla todavia no se copio
 * en ningun sitio.
 */
export function evaluarImpacto(c: CambiosPlantilla, seguimientos: number): Impacto {
  const impacto: Impacto = { bloqueos: [], advertencias: [] }
  if (seguimientos <= 0) return impacto

  const sitios = `${seguimientos} ${plural(seguimientos, 'sitio en seguimiento', 'sitios en seguimiento')}`

  if (c.etapasQuitadas.length > 0) {
    impacto.bloqueos.push(
      `No se puede quitar ${nombres(c.etapasQuitadas)}: ${sitios} usan esta plantilla y ${plural(c.etapasQuitadas.length, 'esa etapa', 'esas etapas')} dejarían de poder avanzar. Descarta los cambios para recuperarla, o duplica la plantilla y edita la copia.`,
    )
  }
  if (c.desactivada) {
    impacto.bloqueos.push(
      `No se puede desactivar: ${sitios} usan esta plantilla y sus etapas perderían nombre y color en el embudo, el kanban y el mapa. Déjala activa hasta que esos sitios cierren.`,
    )
  }
  if (c.etapasNuevas.length > 0) {
    impacto.advertencias.push(
      `${nombres(c.etapasNuevas)} solo se agrega a los sitios que entren desde ahora. Los ${sitios} actuales siguen con sus etapas de siempre.`,
    )
  }
  if (c.reordenada) {
    impacto.advertencias.push(
      `El nuevo orden se aplica a los sitios que entren desde ahora. Los ${sitios} actuales conservan su secuencia; el embudo y el kanban muestran las columnas en el orden nuevo.`,
    )
  }
  if (c.sla.length > 0) {
    impacto.advertencias.push(
      `El SLA nuevo de ${nombres(c.sla)} se usa para calcular las fechas plan de los sitios que entren desde ahora. Las fechas plan actuales no cambian.`,
    )
  }
  if (c.obligatoriosNuevos.length > 0) {
    const n = c.obligatoriosNuevos.length
    impacto.advertencias.push(
      `${n} ${plural(n, 'entregable obligatorio nuevo', 'entregables obligatorios nuevos')} en ${nombres(c.obligatoriosNuevos)}: los sitios que estén en esa etapa van a tener que marcarlo para avanzar.`,
    )
  }
  if (c.checklistOtros.length > 0) {
    impacto.advertencias.push(
      `Cambian las exigencias del checklist de ${nombres(c.checklistOtros)}. Rige de inmediato para los sitios que aún no cierran esa etapa; lo ya marcado queda en su historial.`,
    )
  }
  if (c.revisiones.length > 0) {
    impacto.advertencias.push(
      `Cambian las revisiones de ${nombres(c.revisiones)}. Los sitios actuales conservan las revisiones con las que se crearon.`,
    )
  }
  return impacto
}

/** Resumen de una linea por cambio, para la auditoria. */
export function resumirCambios(c: CambiosPlantilla): string[] {
  const lineas: string[] = []
  if (c.nombre) lineas.push('Nombre de la plantilla')
  if (c.descripcion) lineas.push('Descripción de la plantilla')
  if (c.activo) lineas.push('Plantilla activa')
  if (c.etapasNuevas.length) lineas.push(`Etapas nuevas: ${nombres(c.etapasNuevas)}`)
  if (c.etapasQuitadas.length) lineas.push(`Etapas quitadas: ${nombres(c.etapasQuitadas)}`)
  if (c.reordenada) lineas.push('Orden de las etapas')
  if (c.etapasPresentacion.length) {
    lineas.push(`Nombre, descripción o color: ${nombres(c.etapasPresentacion)}`)
  }
  if (c.sla.length) lineas.push(`SLA: ${nombres(c.sla)}`)
  const checklist = [...c.obligatoriosNuevos, ...c.checklistOtros, ...c.checklistMenores]
  if (checklist.length) lineas.push(`Checklist: ${nombres(checklist)}`)
  if (c.revisiones.length) lineas.push(`Revisiones: ${nombres(c.revisiones)}`)
  return lineas
}

/** Secuencia legible, para la auditoria: "TSSR → FC → RFI". */
export function secuenciaLegible(p: GateTemplate): string {
  return [...p.gates]
    .sort((a, b) => a.orden - b.orden)
    .map((g) => g.nombre)
    .join(' → ')
}
