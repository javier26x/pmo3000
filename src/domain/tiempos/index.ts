/**
 * Tiempos del proceso: cuanto tarda cada etapa y cada validador dentro de ella.
 *
 * El reloj de una etapa arranca cuando se cerro la etapa secuencial anterior
 * (la misma regla que el SLA, ver domain/sla): cuando el TSS quedo aprobado
 * por todos, empieza a correr la Ingenieria. Y se detiene en la fecha real de
 * cierre de la propia etapa.
 *
 * Dentro de la etapa, cada validador (RF, OOCC, ECE...) tiene su propio reloj
 * con el mismo inicio: se detiene en la fecha de su revision cuando la aprueba.
 * Asi se ve lo que el tracker esconde: que el TSS lo aprobo RF en 4 dias y la
 * etapa tardo 30 porque OOCC tardo 30.
 *
 * Solo se mide con fechas que el tracker trae. Una etapa sin inicio conocido
 * (la primera, o una cuya anterior se cerro sin fecha) no se mide: inventarle
 * un inicio daria numeros que parecen ciertos y no lo son.
 */
import { diasEntre, diasHabilesEntre, type FechaISO } from '@/domain/fechas'
import { secuenciaDeGates } from '@/domain/gates/catalogo'
import { clasificarEstado, estaCerrado, type EstadoSemantico } from '@/domain/tracker/estados'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

export interface TiempoRevision {
  id: string
  nombre: string
  estado: EstadoSemantico
  /** Fecha de la revision en el tracker. */
  fecha: FechaISO | null
  /** Dias desde que arranco la etapa hasta que aprobo, o hasta hoy si aun no aprueba. */
  dias: number | null
  /** true: todavia no aprueba y la etapa esta en curso, el reloj sigue. */
  corriendo: boolean
}

export interface TiempoEtapa {
  codigo: string
  nombre: string
  /** Cierre de la etapa anterior: cuando arranco el reloj. */
  inicio: FechaISO | null
  /** Cierre de esta etapa. */
  fin: FechaISO | null
  dias: number | null
  corriendo: boolean
  revisiones: TiempoRevision[]
}

function contador(habiles: boolean): (a: FechaISO, b: FechaISO) => number {
  return (a, b) => Math.max(0, habiles ? diasHabilesEntre(a, b) : diasEntre(a, b))
}

/**
 * Los tiempos de cada etapa secuencial del sitio, en orden. Las paralelas (FC,
 * contrato) no tienen un inicio que se desprenda de la secuencia y quedan fuera.
 */
export function tiemposDelSitio(
  sp: SitioProyecto,
  plantilla: GateTemplate | null,
  hoy: FechaISO,
  habiles = false,
): TiempoEtapa[] {
  const contar = contador(habiles)
  const homologacion = plantilla?.homologacion ?? {}
  const secuencia = secuenciaDeGates(sp.gates)

  return secuencia.flatMap((codigo, i) => {
    const gate = sp.gates[codigo]
    if (!gate) return []
    const anterior = i > 0 ? sp.gates[secuencia[i - 1]!] : undefined
    const inicio = anterior?.fechaReal ?? null
    const completada = gate.estado === 'completado'
    const fin = completada ? gate.fechaReal : null
    const corriendo = !completada && sp.gateActual === codigo
    const dias =
      inicio === null
        ? null
        : fin !== null
          ? contar(inicio, fin)
          : corriendo
            ? contar(inicio, hoy)
            : null

    // Las de la plantilla, y ademas las que el documento traiga y la plantilla
    // ya no tenga: igual que PanelRevisiones.
    const definidas = plantilla?.gates.find((g) => g.codigo === codigo)?.revisiones ?? []
    const nombres = new Map(definidas.map((r) => [r.id, r.nombre]))
    for (const id of Object.keys(gate.revisiones)) if (!nombres.has(id)) nombres.set(id, id)

    const revisiones = [...nombres].map(([id, nombre]): TiempoRevision => {
      const rev = gate.revisiones[id]
      const estado = clasificarEstado(rev?.estado ?? '', homologacion)
      const fecha = rev?.fecha ?? null
      const aprobada = estaCerrado(estado) && estado !== 'no_aplica'
      if (inicio !== null && aprobada && fecha !== null) {
        return { id, nombre, estado, fecha, dias: contar(inicio, fecha), corriendo: false }
      }
      if (inicio !== null && !aprobada && estado !== 'no_aplica' && corriendo) {
        return { id, nombre, estado, fecha, dias: contar(inicio, hoy), corriendo: true }
      }
      return { id, nombre, estado, fecha, dias: null, corriendo: false }
    })

    return [{ codigo, nombre: gate.nombre || codigo, inicio, fin, dias, corriendo, revisiones }]
  })
}

// --------------------------------------------------------------- resumen

export interface Estadistica {
  n: number
  mediana: number | null
  promedio: number | null
  maximo: number | null
}

export interface ResumenTiempos {
  /** Casos ya cerrados: cuanto tomo. */
  cerradas: Estadistica
  /** Casos en curso: cuanto llevan hasta hoy. */
  enCurso: Estadistica
}

export interface ResumenRevision extends ResumenTiempos {
  id: string
  nombre: string
}

export interface ResumenEtapa extends ResumenTiempos {
  codigo: string
  nombre: string
  revisiones: ResumenRevision[]
}

export function estadistica(valores: readonly number[]): Estadistica {
  const n = valores.length
  if (n === 0) return { n: 0, mediana: null, promedio: null, maximo: null }
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(n / 2)
  const mediana = n % 2 === 1 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2
  const promedio = orden.reduce((s, v) => s + v, 0) / n
  return { n, mediana, promedio, maximo: orden[n - 1]! }
}

interface Acumulado {
  cerradas: number[]
  enCurso: number[]
}

function sumar(acc: Acumulado, dias: number | null, corriendo: boolean): void {
  if (dias === null) return
  ;(corriendo ? acc.enCurso : acc.cerradas).push(dias)
}

function resumir(acc: Acumulado): ResumenTiempos {
  return { cerradas: estadistica(acc.cerradas), enCurso: estadistica(acc.enCurso) }
}

/**
 * Junta los tiempos de muchos sitios por etapa y por validador. Las etapas
 * salen en el orden en que aparecen en las secuencias; los validadores, en el
 * de la plantilla.
 */
export function resumirTiempos(sitios: readonly (readonly TiempoEtapa[])[]): ResumenEtapa[] {
  const etapas = new Map<
    string,
    {
      nombre: string
      posicion: number
      acc: Acumulado
      revisiones: Map<string, { nombre: string; acc: Acumulado }>
    }
  >()

  for (const tiempos of sitios) {
    tiempos.forEach((t, posicion) => {
      let etapa = etapas.get(t.codigo)
      if (!etapa) {
        etapa = {
          nombre: t.nombre,
          posicion,
          acc: { cerradas: [], enCurso: [] },
          revisiones: new Map(),
        }
        etapas.set(t.codigo, etapa)
      }
      sumar(etapa.acc, t.dias, t.corriendo)
      for (const r of t.revisiones) {
        let rev = etapa.revisiones.get(r.id)
        if (!rev) {
          rev = { nombre: r.nombre, acc: { cerradas: [], enCurso: [] } }
          etapa.revisiones.set(r.id, rev)
        }
        sumar(rev.acc, r.dias, r.corriendo)
      }
    })
  }

  return [...etapas]
    .sort((a, b) => a[1].posicion - b[1].posicion)
    .map(([codigo, e]) => ({
      codigo,
      nombre: e.nombre,
      ...resumir(e.acc),
      revisiones: [...e.revisiones].map(([id, r]) => ({ id, nombre: r.nombre, ...resumir(r.acc) })),
    }))
}

/** "12 d", "4,5 d", "—". */
export function textoDias(dias: number | null): string {
  if (dias === null) return '—'
  const redondeado = Math.round(dias * 10) / 10
  return `${redondeado.toLocaleString('es-CL')} d`
}
