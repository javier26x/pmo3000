import { describe, expect, it } from 'vitest'
import { actor, cumplirChecklist, plantilla, sitioProyecto } from '@/pruebas/fabricas'
import {
  contextoDe,
  crearGatesDesdePlantilla,
  planAvanzarGate,
  planCorreccionAdmin,
  planRegistrarFecha,
  planRetrocederGate,
} from './maquina'
import { CERRADO, secuenciaDeGates } from './catalogo'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { Parche } from './maquina'

/**
 * Las tres copias del gate en curso (fechaPlanGateActual, fechaRealGateActual,
 * ordenGateActual) son lo que la tabla, el kanban, el mapa y el Inicio leen en
 * vez de abrir el mapa `gates`.
 *
 * Que se desincronicen no rompe nada de forma visible: el sitio simplemente
 * queda mal ordenado y con el semaforo equivocado, que es justo el tipo de fallo
 * que nadie reporta. Por eso el invariante se prueba en cada camino que mueve el
 * gate, y no solo en el que se acaba de escribir.
 */
const AHORA = new Date('2026-02-01T15:00:00Z')
const ctx = (rol: Parameters<typeof actor>[0]) => contextoDe(actor(rol), AHORA)

/** Aplica un parche de campos con ruta punteada sobre una copia del documento. */
function aplicar(sp: SitioProyecto, parche: Parche): SitioProyecto {
  const copia = structuredClone(sp) as SitioProyecto
  for (const [ruta, valor] of Object.entries(parche.campos)) {
    const partes = ruta.split('.')
    let nodo = copia as unknown as Record<string, unknown>
    for (const parte of partes.slice(0, -1)) {
      nodo = nodo[parte] as Record<string, unknown>
    }
    nodo[partes[partes.length - 1]!] = valor
  }
  return copia
}

/** El contrato: las copias dicen lo mismo que el gate en curso del mapa. */
function esperarCoherencia(sp: SitioProyecto): void {
  if (sp.gateActual === CERRADO) {
    expect(sp.fechaPlanGateActual).toBeNull()
    expect(sp.fechaRealGateActual).toBeNull()
    expect(sp.ordenGateActual).toBeNull()
    return
  }
  const gate = sp.gates[sp.gateActual]
  expect(gate, `el gate ${sp.gateActual} tiene que existir en el mapa`).toBeDefined()
  expect(sp.fechaPlanGateActual).toBe(gate?.fechaPlan ?? null)
  expect(sp.fechaRealGateActual).toBe(gate?.fechaReal ?? null)
  expect(sp.ordenGateActual).toBe(gate?.orden ?? null)
}

describe('copias del gate actual', () => {
  it('quedan coherentes al instanciar la plantilla', () => {
    const r = crearGatesDesdePlantilla(plantilla, {
      fechaInicio: '2026-01-01',
      responsableUid: null,
      proveedorId: null,
    })
    expect(r.ordenGateActual).toBe(r.gates[r.gateActual as string]?.orden)
    expect(r.fechaPlanGateActual).toBe(r.gates[r.gateActual as string]?.fechaPlan)
    // Un sitio recien creado no tiene ninguna etapa cerrada.
    expect(r.fechaRealGateActual).toBeNull()
  })

  it('siguen al gate al avanzar, y el orden avanza con el', () => {
    const inicial = cumplirChecklist(sitioProyecto(), sitioProyecto().gateActual)
    const r = planAvanzarGate(inicial, plantilla, ctx('admin'), {
      fechaReal: '2026-01-20',
      comentario: '',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const despues = aplicar(inicial, r.valor)
    esperarCoherencia(despues)
    // No es solo "no es null": el orden tiene que haber subido de verdad.
    expect(despues.ordenGateActual).toBeGreaterThan(inicial.ordenGateActual ?? -1)
    // La fecha real que se acaba de escribir es la del gate que quedo atras,
    // no la del nuevo gate en curso.
    expect(despues.fechaRealGateActual).toBeNull()
  })

  it('al retroceder no arrastran la fecha real del gate reabierto', () => {
    const inicial = cumplirChecklist(sitioProyecto(), sitioProyecto().gateActual)
    const avance = planAvanzarGate(inicial, plantilla, ctx('admin'), {
      fechaReal: '2026-01-20',
      comentario: '',
    })
    expect(avance.ok).toBe(true)
    if (!avance.ok) return
    const avanzado = aplicar(inicial, avance.valor)

    const r = planRetrocederGate(avanzado, plantilla, ctx('admin'), 'se cargo mal la fecha')
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const despues = aplicar(avanzado, r.valor)
    esperarCoherencia(despues)
    // El gate al que se vuelve tenia fechaReal: el retroceso la borra, y la
    // copia tiene que reflejar eso y no el valor viejo.
    expect(despues.fechaRealGateActual).toBeNull()
    expect(despues.ordenGateActual).toBe(inicial.ordenGateActual)
  })

  it('siguen la fecha plan y la fecha real que se editan sobre el gate en curso', () => {
    const sp = sitioProyecto()
    const codigo = sp.gateActual as string

    const plan = planRegistrarFecha(sp, plantilla, ctx('admin'), {
      codigo,
      campo: 'fechaPlan',
      fecha: '2026-03-15',
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const conPlan = aplicar(sp, plan.valor)
    expect(conPlan.fechaPlanGateActual).toBe('2026-03-15')
    esperarCoherencia(conPlan)

    const real = planRegistrarFecha(conPlan, plantilla, ctx('admin'), {
      codigo,
      campo: 'fechaReal',
      fecha: '2026-01-31',
    })
    expect(real.ok).toBe(true)
    if (!real.ok) return
    const conReal = aplicar(conPlan, real.valor)
    expect(conReal.fechaRealGateActual).toBe('2026-01-31')
    esperarCoherencia(conReal)
  })

  it('no se tocan al editar una fecha de OTRA etapa', () => {
    const sp = sitioProyecto()
    const secuencia = secuenciaDeGates(sp.gates).filter((g) => g !== CERRADO)
    const otra = secuencia.find((g) => g !== sp.gateActual)
    expect(otra, 'la plantilla de prueba necesita mas de una etapa').toBeDefined()

    const r = planRegistrarFecha(sp, plantilla, ctx('admin'), {
      codigo: otra as string,
      campo: 'fechaPlan',
      fecha: '2026-09-09',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.campos).not.toHaveProperty('fechaPlanGateActual')
    expect(r.valor.campos).not.toHaveProperty('fechaRealGateActual')
    esperarCoherencia(aplicar(sp, r.valor))
  })

  it('quedan en null cuando el sitio se cierra', () => {
    let sp = cumplirChecklist(sitioProyecto(), sitioProyecto().gateActual)
    // Se avanza hasta CERRADO cumpliendo el checklist de cada etapa.
    for (let i = 0; i < 20 && sp.gateActual !== CERRADO; i++) {
      const listo = cumplirChecklist(sp, sp.gateActual)
      const r = planAvanzarGate(listo, plantilla, ctx('admin'), {
        fechaReal: '2026-01-20',
        comentario: '',
      })
      if (!r.ok) break
      sp = aplicar(listo, r.valor)
      esperarCoherencia(sp)
    }
    expect(sp.gateActual).toBe(CERRADO)
    expect(sp.fechaPlanGateActual).toBeNull()
    expect(sp.fechaRealGateActual).toBeNull()
    expect(sp.ordenGateActual).toBeNull()
  })

  it('las mantiene la correccion administrativa', () => {
    const sp = sitioProyecto()
    const secuencia = secuenciaDeGates(sp.gates).filter((g) => g !== CERRADO)
    const destino = secuencia[secuencia.length - 1]
    expect(destino).toBeDefined()

    const r = planCorreccionAdmin(sp, ctx('admin'), {
      destino: destino as string,
      fechaReal: '2026-01-15',
      motivo: 'el tracker venia desfasado',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    esperarCoherencia(aplicar(sp, r.valor))
  })
})
