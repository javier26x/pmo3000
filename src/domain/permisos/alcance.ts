/**
 * Alcance de un usuario: el recorte del despliegue que puede ver y tocar.
 *
 * Un usuario no admin puede tener asignadas listas de celulas, programas y
 * proyectos. Si alguna trae algo, solo ve (y solo escribe) los seguimientos que
 * caen en alguna de ellas: su celula esta en la lista de celulas, O su programa
 * en la de programas, O su proyecto en la de proyectos. Las tres vacias
 * significan "sin restriccion". Al admin nunca se le aplica.
 *
 * Igual que la matriz, esto es lo que usa el cliente para armar sus consultas y
 * para no ofrecer lo que va a fallar. La AUTORIDAD es firestore.rules
 * (enAlcance), que evalua lo mismo documento por documento. Por eso las
 * consultas de un usuario acotado DEBEN llevar el or() que arma
 * `disyuncionesAlcance`: sin el, Firestore no puede probar que todos los
 * resultados son visibles y rechaza la consulta completa.
 */
import type { Alcance, Rol } from '@/domain/tipos/comunes'
import { MAX_ENTRADAS_ALCANCE } from '@/domain/tipos/usuario'

export { MAX_ENTRADAS_ALCANCE }

/** Sin restriccion. Una funcion y no una constante: cada uno recibe sus listas. */
export const alcanceVacio = (): Alcance => ({ celulas: [], programas: [], proyectos: [] })

type ConAlcance = { rol: Rol; alcance?: Alcance | null | undefined }

/** Campo del seguimiento que corresponde a cada lista del alcance. */
export const CAMPOS_ALCANCE = {
  celulas: 'celulaId',
  programas: 'programaId',
  proyectos: 'proyectoId',
} as const satisfies Record<keyof Alcance, string>

export type CampoAlcance = (typeof CAMPOS_ALCANCE)[keyof typeof CAMPOS_ALCANCE]

/** Entradas del alcance sumando las tres listas. */
export function totalEntradas(alcance: Alcance | null | undefined): number {
  if (!alcance) return 0
  return alcance.celulas.length + alcance.programas.length + alcance.proyectos.length
}

/**
 * True si el actor ve solo un recorte. Un admin nunca: aunque su perfil traiga
 * listas (por ejemplo, porque lo promovieron despues de acotarlo), las reglas
 * lo dejan pasar igual.
 */
export function tieneAlcance(actor: ConAlcance): boolean {
  return actor.rol !== 'admin' && totalEntradas(actor.alcance) > 0
}

/** Lo que las reglas evaluan sobre cada documento, en version cliente. */
export function estaEnAlcance(
  actor: ConAlcance,
  sp: { celulaId: string | null; programaId: string | null; proyectoId: string | null },
): boolean {
  if (!tieneAlcance(actor) || !actor.alcance) return true
  const a = actor.alcance
  return (
    (sp.celulaId !== null && a.celulas.includes(sp.celulaId)) ||
    (sp.programaId !== null && a.programas.includes(sp.programaId)) ||
    (sp.proyectoId !== null && a.proyectos.includes(sp.proyectoId))
  )
}

/**
 * Disyunciones que una consulta de seguimientos debe llevar para que las reglas
 * puedan probarla: una por lista no vacia, como `where(campo, 'in', valores)`
 * dentro de un or(). Null si el actor no esta acotado.
 */
export function disyuncionesAlcance(
  actor: ConAlcance,
): { campo: CampoAlcance; valores: string[] }[] | null {
  if (!tieneAlcance(actor) || !actor.alcance) return null
  const a = actor.alcance
  return (Object.keys(CAMPOS_ALCANCE) as (keyof Alcance)[])
    .filter((lista) => a[lista].length > 0)
    .map((lista) => ({ campo: CAMPOS_ALCANCE[lista], valores: [...a[lista]] }))
}

/**
 * Como acotar una consulta que ya trae filtros de igualdad del usuario.
 *
 * Por que no basta con agregar siempre el or() completo: Firestore reparte la
 * consulta en disyunciones y evalua la regla sobre cada una. Si el usuario
 * filtra programaId == 'p1' y su alcance es or(programaId in ['p2'],
 * proyectoId in ['q1']), una de las disyunciones queda "programaId == p1 Y
 * programaId == p2": no devuelve nada, pero la regla no lo sabe, no puede
 * probarla y rechaza la consulta completa. Probado contra el emulador.
 *
 * Asi que, por cada lista del alcance cuyo campo el usuario ya fijo:
 * - si el valor fijado esta en la lista, esa igualdad sola prueba el alcance y
 *   no hace falta ningun or() ('sinRestriccion');
 * - si no esta, esa disyuncion es imposible y se quita.
 * Si no queda ninguna, nada de lo filtrado cae en el alcance ('vacio'): no
 * hay que consultar.
 */
export type PlanAlcance =
  | { tipo: 'sinRestriccion' }
  | { tipo: 'vacio' }
  | { tipo: 'disyunciones'; disyunciones: { campo: CampoAlcance; valores: string[] }[] }

export function planAlcance(
  actor: ConAlcance,
  igualdades: Partial<Record<string, string>>,
): PlanAlcance {
  const disyunciones = disyuncionesAlcance(actor)
  if (!disyunciones) return { tipo: 'sinRestriccion' }

  const restantes: typeof disyunciones = []
  for (const d of disyunciones) {
    const fijado = igualdades[d.campo]
    if (fijado === undefined) restantes.push(d)
    else if (d.valores.includes(fijado)) return { tipo: 'sinRestriccion' }
  }
  return restantes.length > 0
    ? { tipo: 'disyunciones', disyunciones: restantes }
    : { tipo: 'vacio' }
}

/** Limpia un alcance: sin vacios, sin repetidos y en orden estable. */
export function normalizarAlcance(alcance: Partial<Alcance> | null | undefined): Alcance {
  const limpiar = (lista: readonly string[] | undefined) =>
    [...new Set((lista ?? []).map((v) => v.trim()).filter(Boolean))].sort()
  return {
    celulas: limpiar(alcance?.celulas),
    programas: limpiar(alcance?.programas),
    proyectos: limpiar(alcance?.proyectos),
  }
}

/** Mensaje de error, o null si el alcance se puede guardar. */
export function validarAlcance(alcance: Alcance): string | null {
  const total = totalEntradas(alcance)
  if (total > MAX_ENTRADAS_ALCANCE) {
    return `El alcance admite como máximo ${MAX_ENTRADAS_ALCANCE} entradas en total (hay ${total}). Firestore no puede consultar más de ${MAX_ENTRADAS_ALCANCE} valores a la vez.`
  }
  return null
}

export function mismoAlcance(a: Alcance, b: Alcance): boolean {
  return serializarAlcance(a) === serializarAlcance(b)
}

/** Texto estable para la auditoria: "celulas: a, b | programas: - | proyectos: x". */
export function serializarAlcance(alcance: Alcance): string {
  const n = normalizarAlcance(alcance)
  if (totalEntradas(n) === 0) return 'Todo'
  const parte = (etiqueta: string, lista: string[]) =>
    `${etiqueta}: ${lista.length ? lista.join(', ') : '-'}`
  return [
    parte('celulas', n.celulas),
    parte('programas', n.programas),
    parte('proyectos', n.proyectos),
  ].join(' | ')
}

export interface NombresAlcance {
  celula: (id: string) => string
  programa: (id: string) => string
  proyecto: (id: string) => string
}

/** Cada entrada del alcance con su etiqueta legible, para chips y resumenes. */
export function entradasAlcance(
  alcance: Alcance,
  nombres: NombresAlcance,
): { tipo: keyof Alcance; id: string; etiqueta: string }[] {
  return [
    ...alcance.celulas.map((id) => ({
      tipo: 'celulas' as const,
      id,
      etiqueta: `Célula ${nombres.celula(id)}`,
    })),
    ...alcance.programas.map((id) => ({
      tipo: 'programas' as const,
      id,
      etiqueta: `Programa ${nombres.programa(id)}`,
    })),
    ...alcance.proyectos.map((id) => ({
      tipo: 'proyectos' as const,
      id,
      etiqueta: `Proyecto ${nombres.proyecto(id)}`,
    })),
  ]
}

/**
 * Resumen corto: "Todo" sin restriccion; si no, las primeras entradas y cuantas
 * mas quedan ("Célula Norte, Programa 5G y 3 más").
 */
export function describirAlcance(
  alcance: Alcance,
  nombres: NombresAlcance,
  maximo = 2,
): string {
  const entradas = entradasAlcance(alcance, nombres)
  if (entradas.length === 0) return 'Todo'
  const visibles = entradas.slice(0, maximo).map((e) => e.etiqueta)
  const resto = entradas.length - visibles.length
  return resto > 0 ? `${visibles.join(', ')} y ${resto} más` : visibles.join(', ')
}
