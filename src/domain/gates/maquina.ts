/**
 * Maquina de gates: la regla de negocio central de la PMO.
 *
 * Todo es puro. Estas funciones NO escriben en Firestore: devuelven un parche
 * (campos a actualizar, con notacion de punto) y los eventos de auditoria que
 * corresponden. El repositorio los aplica en un solo writeBatch, de modo que el
 * cambio y su rastro entran juntos o no entran.
 *
 * Las mismas restricciones estan replicadas en firestore.rules. Si cambias una
 * regla aqui, cambiala alla y en tests/rules.
 */
import { diasEntre, hoyEnChile, sumarDias, type FechaISO } from '@/domain/fechas'
import type { Actor } from '@/domain/tipos/comunes'
import type { GatePlantilla, GateTemplate, ItemPlantilla } from '@/domain/tipos/gate'
import type { GateSitio, ItemChecklist, SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { EventoAuditoriaNuevo } from '@/domain/tipos/auditoria'
import { puede } from '@/domain/permisos/matriz'
import {
  CERRADO,
  gateAnterior,
  ordenGate,
  siguienteGate,
  type CodigoGate,
  type GateActual,
} from './catalogo'
import { codigosDePlantilla, gateDePlantilla } from '@/domain/tipos/gate'

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string }

export interface Parche {
  /** Claves con notacion de punto, listas para un update parcial. */
  campos: Record<string, unknown>
  eventos: EventoAuditoriaNuevo[]
}

export interface ContextoCambio {
  actor: Actor
  ahora: Date
  hoy: FechaISO
}

export function contextoDe(actor: Actor, ahora: Date = new Date()): ContextoCambio {
  return { actor, ahora, hoy: hoyEnChile(ahora) }
}

// ---------------------------------------------------------------------------
// Creacion del seguimiento a partir de la plantilla
// ---------------------------------------------------------------------------

export interface OpcionesGatesIniciales {
  fechaInicio: FechaISO | null
  responsableUid: string | null
  proveedorId: string | null
}

/**
 * Instancia la plantilla de gates en un sitio. Las fechas plan se encadenan
 * sumando el SLA de cada gate a partir de `fechaInicio`; si no hay fecha de
 * inicio los gates quedan sin fecha plan y la PMO las carga despues.
 */
export function crearGatesDesdePlantilla(
  plantilla: GateTemplate,
  opciones: OpcionesGatesIniciales,
): {
  gates: Partial<Record<CodigoGate, GateSitio>>
  gateActual: GateActual
  estadoGate: GateSitio['estado']
  fechaPlanGateActual: FechaISO | null
} {
  const ordenados = [...plantilla.gates].sort((a, b) => a.orden - b.orden)
  const gates: Partial<Record<CodigoGate, GateSitio>> = {}

  let acumulado = opciones.fechaInicio
  for (const g of ordenados) {
    const fechaPlan = acumulado ? sumarDias(acumulado, g.slaDias) : null
    if (fechaPlan) acumulado = fechaPlan

    const checklist: Record<string, ItemChecklist> = {}
    for (const item of g.checklist) {
      checklist[item.id] = { ok: false, obs: '', evidenciaUrl: '', por: null, en: null }
    }

    gates[g.codigo] = {
      orden: g.orden,
      estado: 'no_iniciado',
      fechaPlan,
      fechaReal: null,
      fechaBaseline: null,
      responsableUid: opciones.responsableUid,
      proveedorId: opciones.proveedorId,
      checklist,
      completadoEn: null,
      completadoPor: null,
    }
  }

  const primero = ordenados[0]
  if (!primero) {
    return { gates, gateActual: CERRADO, estadoGate: 'completado', fechaPlanGateActual: null }
  }

  const inicial = gates[primero.codigo]
  if (inicial) inicial.estado = 'en_curso'

  return {
    gates,
    gateActual: primero.codigo,
    estadoGate: 'en_curso',
    fechaPlanGateActual: inicial?.fechaPlan ?? null,
  }
}

// ---------------------------------------------------------------------------
// Consultas puras
// ---------------------------------------------------------------------------

export function gateActualDe(sp: SitioProyecto): GateSitio | null {
  if (sp.gateActual === CERRADO) return null
  return sp.gates[sp.gateActual] ?? null
}

/** Entregables obligatorios que faltan para poder cerrar el gate. */
export function itemsFaltantes(
  gate: GateSitio | null | undefined,
  plantilla: GatePlantilla | undefined,
): ItemPlantilla[] {
  if (!plantilla) return []
  return plantilla.checklist.filter((item) => {
    if (!item.obligatorio) return false
    const marcado = gate?.checklist?.[item.id]
    if (!marcado?.ok) return true
    return item.requiereEvidencia && !marcado.evidenciaUrl.trim()
  })
}

export interface ProgresoChecklist {
  total: number
  completados: number
  obligatoriosPendientes: number
  porcentaje: number
}

export function progresoChecklist(
  gate: GateSitio | null | undefined,
  plantilla: GatePlantilla | undefined,
): ProgresoChecklist {
  const items = plantilla?.checklist ?? []
  const completados = items.filter((i) => gate?.checklist?.[i.id]?.ok).length
  return {
    total: items.length,
    completados,
    obligatoriosPendientes: itemsFaltantes(gate, plantilla).length,
    porcentaje: items.length === 0 ? 0 : Math.round((completados / items.length) * 100),
  }
}

/**
 * Avance del sitio: gates cerrados sobre el total, mas el credito parcial del
 * checklist del gate en curso. Asi un sitio que avanzo la mitad del gate actual
 * no aparece igual que uno que recien lo abrio.
 */
export function porcentajeAvance(sp: SitioProyecto, plantilla: GateTemplate): number {
  const codigos = codigosDePlantilla(plantilla)
  if (codigos.length === 0) return 0
  if (sp.gateActual === CERRADO) return 100

  const cerrados = ordenGate(sp.gateActual)
  const actual = progresoChecklist(gateActualDe(sp), gateDePlantilla(plantilla, sp.gateActual))
  const parcial = actual.total === 0 ? 0 : actual.completados / actual.total

  return Math.min(100, Math.round(((cerrados + parcial) / codigos.length) * 100))
}

// ---------------------------------------------------------------------------
// Validaciones de avance
// ---------------------------------------------------------------------------

export interface EvaluacionAvance {
  permitido: boolean
  motivo: string | null
  itemsFaltantes: ItemPlantilla[]
  destino: GateActual | null
}

export function evaluarAvance(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  actor: Actor,
): EvaluacionAvance {
  const base = { itemsFaltantes: [] as ItemPlantilla[], destino: null as GateActual | null }

  if (!puede(actor.rol, 'sitioProyectos', 'avanzarGate')) {
    return { ...base, permitido: false, motivo: 'Tu rol no puede avanzar gates' }
  }
  if (sp.gateActual === CERRADO) {
    return { ...base, permitido: false, motivo: 'El sitio ya cerro todos los gates' }
  }
  if (sp.bloqueado) {
    return {
      ...base,
      permitido: false,
      motivo: `El sitio esta bloqueado: ${sp.motivoBloqueo ?? 'sin motivo registrado'}`,
    }
  }

  const gatePlantilla = gateDePlantilla(plantilla, sp.gateActual)
  if (!gatePlantilla) {
    return {
      ...base,
      permitido: false,
      motivo: `El gate ${sp.gateActual} no existe en la plantilla ${plantilla.id}`,
    }
  }

  const destino = siguienteGate(sp.gateActual)
  const faltantes = itemsFaltantes(sp.gates[sp.gateActual], gatePlantilla)
  if (faltantes.length > 0) {
    return {
      permitido: false,
      motivo: `Faltan ${faltantes.length} entregable(s) obligatorio(s) del gate ${sp.gateActual}`,
      itemsFaltantes: faltantes,
      destino,
    }
  }

  return { permitido: true, motivo: null, itemsFaltantes: [], destino }
}

/**
 * Valida un movimiento del kanban. Solo se acepta el gate inmediatamente
 * siguiente (avance) o el inmediatamente anterior (retroceso, con permiso).
 */
export function evaluarMovimiento(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  actor: Actor,
  destino: GateActual,
): { permitido: boolean; motivo: string | null; tipo: 'avance' | 'retroceso' | 'ninguno' } {
  if (destino === sp.gateActual) {
    return { permitido: false, motivo: 'El sitio ya esta en ese gate', tipo: 'ninguno' }
  }

  if (destino === siguienteGate(sp.gateActual)) {
    const evaluacion = evaluarAvance(sp, plantilla, actor)
    return { permitido: evaluacion.permitido, motivo: evaluacion.motivo, tipo: 'avance' }
  }

  if (destino === gateAnterior(sp.gateActual)) {
    if (!puede(actor.rol, 'sitioProyectos', 'retrocederGate')) {
      return {
        permitido: false,
        motivo: 'Solo un administrador o jefe de celula puede retroceder un gate',
        tipo: 'retroceso',
      }
    }
    return { permitido: true, motivo: null, tipo: 'retroceso' }
  }

  const salto = Math.abs(ordenGate(destino) - ordenGate(sp.gateActual))
  return {
    permitido: false,
    motivo: `No se puede saltar ${salto} gates: los gates son secuenciales`,
    tipo: 'ninguno',
  }
}

// ---------------------------------------------------------------------------
// Planes de cambio (parche + auditoria)
// ---------------------------------------------------------------------------

function eventoBase(
  sp: SitioProyecto,
): Pick<
  EventoAuditoriaNuevo,
  'entidadTipo' | 'entidadId' | 'sitioId' | 'proyectoId' | 'programaId'
> {
  return {
    entidadTipo: 'sitioProyecto',
    entidadId: sp.id,
    sitioId: sp.sitioId,
    proyectoId: sp.proyectoId,
    programaId: sp.programaId,
  }
}

export interface OpcionesAvance {
  /** Fecha real de cierre del gate actual. */
  fechaReal: FechaISO
  comentario?: string
}

export function planAvanzarGate(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  ctx: ContextoCambio,
  opciones: OpcionesAvance,
): Resultado<Parche> {
  const evaluacion = evaluarAvance(sp, plantilla, ctx.actor)
  if (!evaluacion.permitido || !evaluacion.destino) {
    return { ok: false, motivo: evaluacion.motivo ?? 'No se puede avanzar el gate' }
  }

  const codigoActual = sp.gateActual as CodigoGate
  if (diasEntre(ctx.hoy, opciones.fechaReal) > 0) {
    return { ok: false, motivo: 'La fecha real de cierre no puede estar en el futuro' }
  }

  const anterior = gateAnterior(codigoActual)
  if (anterior && anterior !== CERRADO) {
    const fechaAnterior = sp.gates[anterior]?.fechaReal
    if (fechaAnterior && diasEntre(fechaAnterior, opciones.fechaReal) < 0) {
      return {
        ok: false,
        motivo: `La fecha real no puede ser anterior al cierre del gate ${anterior}`,
      }
    }
  }

  const destino = evaluacion.destino
  const campos: Record<string, unknown> = {
    [`gates.${codigoActual}.estado`]: 'completado',
    [`gates.${codigoActual}.fechaReal`]: opciones.fechaReal,
    [`gates.${codigoActual}.completadoEn`]: ctx.ahora,
    [`gates.${codigoActual}.completadoPor`]: ctx.actor.uid,
    gateActual: destino,
  }

  if (destino === CERRADO) {
    campos.estadoGate = 'completado'
    campos.fechaPlanGateActual = null
  } else {
    campos[`gates.${destino}.estado`] = 'en_curso'
    campos.estadoGate = 'en_curso'
    campos.fechaPlanGateActual = sp.gates[destino]?.fechaPlan ?? null
  }

  const eventos: EventoAuditoriaNuevo[] = [
    {
      ...eventoBase(sp),
      accion: 'cambio_gate',
      campo: 'gateActual',
      valorAnterior: codigoActual,
      valorNuevo: destino,
      detalle: opciones.comentario?.trim()
        ? `Cierre con fecha real ${opciones.fechaReal}. ${opciones.comentario.trim()}`
        : `Cierre con fecha real ${opciones.fechaReal}`,
    },
  ]

  const fechaRealPrevia = sp.gates[codigoActual]?.fechaReal ?? null
  if (fechaRealPrevia !== opciones.fechaReal) {
    eventos.push({
      ...eventoBase(sp),
      accion: 'actualizar',
      campo: `gates.${codigoActual}.fechaReal`,
      valorAnterior: fechaRealPrevia,
      valorNuevo: opciones.fechaReal,
      detalle: null,
    })
  }

  return { ok: true, valor: { campos, eventos } }
}

export function planRetrocederGate(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  ctx: ContextoCambio,
  motivo: string,
): Resultado<Parche> {
  if (!puede(ctx.actor.rol, 'sitioProyectos', 'retrocederGate')) {
    return { ok: false, motivo: 'Tu rol no puede retroceder gates' }
  }
  if (!motivo.trim()) {
    return { ok: false, motivo: 'Un retroceso de gate exige un motivo' }
  }

  const destino = gateAnterior(sp.gateActual)
  if (!destino || destino === CERRADO) {
    return { ok: false, motivo: 'El sitio ya esta en el primer gate' }
  }
  if (!gateDePlantilla(plantilla, destino)) {
    return { ok: false, motivo: `El gate ${destino} no existe en la plantilla` }
  }

  const campos: Record<string, unknown> = {
    [`gates.${destino}.estado`]: 'en_curso',
    [`gates.${destino}.fechaReal`]: null,
    [`gates.${destino}.completadoEn`]: null,
    [`gates.${destino}.completadoPor`]: null,
    gateActual: destino,
    estadoGate: 'en_curso',
    fechaPlanGateActual: sp.gates[destino]?.fechaPlan ?? null,
  }

  if (sp.gateActual !== CERRADO) {
    campos[`gates.${sp.gateActual}.estado`] = 'no_iniciado'
  }

  return {
    ok: true,
    valor: {
      campos,
      eventos: [
        {
          ...eventoBase(sp),
          accion: 'retroceso_gate',
          campo: 'gateActual',
          valorAnterior: sp.gateActual,
          valorNuevo: destino,
          detalle: motivo.trim(),
        },
      ],
    },
  }
}

export interface OpcionesChecklist {
  codigo: CodigoGate
  itemId: string
  ok: boolean
  obs?: string
  evidenciaUrl?: string
}

export function planMarcarChecklist(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  ctx: ContextoCambio,
  opciones: OpcionesChecklist,
): Resultado<Parche> {
  if (!puede(ctx.actor.rol, 'sitioProyectos', 'editarChecklist')) {
    return { ok: false, motivo: 'Tu rol no puede editar el checklist' }
  }
  if (ctx.actor.rol === 'contratista' && sp.proveedorId !== ctx.actor.proveedorId) {
    return { ok: false, motivo: 'Solo puedes editar sitios asignados a tu empresa' }
  }

  const gatePlantilla = gateDePlantilla(plantilla, opciones.codigo)
  const item = gatePlantilla?.checklist.find((i) => i.id === opciones.itemId)
  if (!gatePlantilla || !item) {
    return { ok: false, motivo: 'El entregable no existe en la plantilla de este gate' }
  }
  if (ordenGate(opciones.codigo) > ordenGate(sp.gateActual)) {
    return { ok: false, motivo: 'No se puede marcar el checklist de un gate futuro' }
  }

  const previo = sp.gates[opciones.codigo]?.checklist?.[opciones.itemId]
  const evidencia = opciones.evidenciaUrl ?? previo?.evidenciaUrl ?? ''
  if (opciones.ok && item.requiereEvidencia && !evidencia.trim()) {
    return { ok: false, motivo: `"${item.texto}" exige adjuntar evidencia` }
  }

  const prefijo = `gates.${opciones.codigo}.checklist.${opciones.itemId}`
  const campos: Record<string, unknown> = {
    [`${prefijo}.ok`]: opciones.ok,
    [`${prefijo}.obs`]: opciones.obs ?? previo?.obs ?? '',
    [`${prefijo}.evidenciaUrl`]: evidencia,
    [`${prefijo}.por`]: ctx.actor.uid,
    [`${prefijo}.en`]: ctx.ahora,
  }

  return {
    ok: true,
    valor: {
      campos,
      eventos: [
        {
          ...eventoBase(sp),
          accion: 'checklist',
          campo: `${opciones.codigo}: ${item.texto}`,
          valorAnterior: previo?.ok ? 'cumplido' : 'pendiente',
          valorNuevo: opciones.ok ? 'cumplido' : 'pendiente',
          detalle: opciones.obs?.trim() ? opciones.obs.trim() : null,
        },
      ],
    },
  }
}

export function planRegistrarFecha(
  sp: SitioProyecto,
  plantilla: GateTemplate,
  ctx: ContextoCambio,
  opciones: { codigo: CodigoGate; campo: 'fechaPlan' | 'fechaReal'; fecha: FechaISO | null },
): Resultado<Parche> {
  const accionRequerida = opciones.campo === 'fechaReal' ? 'registrarFechaReal' : 'editar'
  if (!puede(ctx.actor.rol, 'sitioProyectos', accionRequerida)) {
    return { ok: false, motivo: 'Tu rol no puede modificar esta fecha' }
  }
  if (ctx.actor.rol === 'contratista' && sp.proveedorId !== ctx.actor.proveedorId) {
    return { ok: false, motivo: 'Solo puedes editar sitios asignados a tu empresa' }
  }
  if (!gateDePlantilla(plantilla, opciones.codigo)) {
    return { ok: false, motivo: 'El gate no existe en la plantilla' }
  }
  if (opciones.campo === 'fechaReal' && opciones.fecha && diasEntre(ctx.hoy, opciones.fecha) > 0) {
    return { ok: false, motivo: 'La fecha real no puede estar en el futuro' }
  }

  const previo = sp.gates[opciones.codigo]?.[opciones.campo] ?? null
  const campos: Record<string, unknown> = {
    [`gates.${opciones.codigo}.${opciones.campo}`]: opciones.fecha,
  }

  // El campo desnormalizado que alimenta la consulta de atrasados debe seguir al plan.
  if (opciones.campo === 'fechaPlan' && opciones.codigo === sp.gateActual) {
    campos.fechaPlanGateActual = opciones.fecha
  }

  return {
    ok: true,
    valor: {
      campos,
      eventos: [
        {
          ...eventoBase(sp),
          accion: 'actualizar',
          campo: `gates.${opciones.codigo}.${opciones.campo}`,
          valorAnterior: previo,
          valorNuevo: opciones.fecha,
          detalle: null,
        },
      ],
    },
  }
}

export function planBloqueo(
  sp: SitioProyecto,
  ctx: ContextoCambio,
  opciones: { bloqueado: boolean; motivo: string },
): Resultado<Parche> {
  if (!puede(ctx.actor.rol, 'sitioProyectos', 'editar')) {
    return { ok: false, motivo: 'Tu rol no puede bloquear o desbloquear sitios' }
  }
  if (opciones.bloqueado && !opciones.motivo.trim()) {
    return { ok: false, motivo: 'Bloquear un sitio exige un motivo' }
  }

  return {
    ok: true,
    valor: {
      campos: {
        bloqueado: opciones.bloqueado,
        motivoBloqueo: opciones.bloqueado ? opciones.motivo.trim() : null,
        estadoGate: opciones.bloqueado ? 'bloqueado' : 'en_curso',
      },
      eventos: [
        {
          ...eventoBase(sp),
          accion: 'actualizar',
          campo: 'bloqueado',
          valorAnterior: sp.bloqueado ? 'si' : 'no',
          valorNuevo: opciones.bloqueado ? 'si' : 'no',
          detalle: opciones.bloqueado ? opciones.motivo.trim() : 'Sitio desbloqueado',
        },
      ],
    },
  }
}
