/**
 * Escritura de la importacion de un tracker completo.
 *
 * Se diferencia de repos/importacion.ts en que aquella importa el MAESTRO de
 * sitios (identidad y coordenadas) y arranca el seguimiento de cero. Esta trae
 * ademas el historial: en que etapa va cada sitio, que dijo cada disciplina, y
 * los ciento treinta atributos propios del tracker.
 *
 * La plantilla se escribe primero, en su propio lote: si algo falla despues, la
 * plantilla queda y reintentar es seguro. Todos los ids son deterministas (el
 * del sitio es el del tracker, el del seguimiento es proyecto__sitio), asi que
 * volver a importar el mismo archivo actualiza en vez de duplicar.
 */
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { agregarEventos } from '../auditoria'
import { idSitioProyecto } from '@/domain/tipos/sitioProyecto'
import {
  avanceFueraDeOrden,
  construirGates,
  convertirFila,
  indexarColumnas,
  type FilaTracker,
} from '@/domain/tracker/aplicacion'
import type { PlantillaInferida } from '@/domain/tracker/inferencia'
import type { EstadoSemantico } from '@/domain/tracker/estados'
import type { Actor, Prioridad } from '@/domain/tipos/comunes'

const MAX_OPERACIONES = 450

export interface DestinoTracker {
  programaId: string
  proyectoId: string
  portafolioId: string
  celulaId: string | null
  proveedorId: string | null
  plantillaId: string
  plantillaVersion: number
  prioridad: Prioridad
}

export interface ResultadoTracker {
  sitiosEscritos: number
  seguimientosEscritos: number
  filasOmitidas: number
  /** Sitios con etapas aprobadas despues de la que los tiene frenados. */
  fueraDeOrden: number
  /** Columna -> cuantas celdas no se pudieron convertir. */
  problemas: Map<string, number>
  error: string | null
}

export interface AvanceTracker {
  procesadas: number
  total: number
}

/** Que paso con la plantilla al importar. */
export type ResultadoPlantilla = 'escrita' | 'existente'

/**
 * Escribe la plantilla del tracker. Documento propio, lote propio.
 *
 * Las plantillas son de administracion (firestore.rules: gateTemplates solo
 * admin), pero importar un tracker lo pueden hacer jefe y analista. Para que
 * eso no falle a mitad de camino:
 *
 * - un admin la crea o la actualiza, como siempre;
 * - un no admin que re-importa sobre una plantilla que YA existe la reutiliza
 *   tal cual (no la reescribe) y la importacion sigue;
 * - un no admin que necesitaria crear una plantilla nueva recibe un error claro
 *   ANTES de escribir nada.
 */
export async function guardarPlantillaTracker(
  plantilla: Record<string, unknown> & { id: string },
  actor: Actor,
): Promise<ResultadoPlantilla> {
  const { id, ...resto } = plantilla

  if (actor.rol !== 'admin') {
    const existente = await getDoc(doc(db, COLECCIONES.gateTemplates, id))
    if (existente.exists()) return 'existente'
    throw new Error(
      `La plantilla "${String(plantilla.nombre ?? id)}" no existe y solo un administrador puede ` +
        'crear plantillas. Pide a un administrador que haga la primera importacion de este ' +
        'tracker; despues podras re-importarlo tu.',
    )
  }

  const lote = writeBatch(db)
  lote.set(
    doc(db, COLECCIONES.gateTemplates, id),
    {
      ...resto,
      creadoEn: serverTimestamp(),
      creadoPor: actor.uid,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: actor.uid,
    },
    { merge: true },
  )
  agregarEventos(
    lote,
    [
      {
        entidadTipo: 'gateTemplate',
        entidadId: id,
        sitioId: null,
        proyectoId: null,
        programaId: null,
        accion: 'importar',
        campo: null,
        valorAnterior: null,
        valorNuevo: String(plantilla.nombre ?? id),
        detalle: 'Plantilla creada desde un tracker importado',
      },
    ],
    actor,
    'import',
  )
  await lote.commit()
  return 'escrita'
}

export async function ejecutarImportacionTracker(
  filas: readonly (readonly unknown[])[],
  propuesta: PlantillaInferida,
  destino: DestinoTracker,
  actor: Actor,
  homologacion: Readonly<Record<string, EstadoSemantico>> = {},
  onAvance?: (avance: AvanceTracker) => void,
): Promise<ResultadoTracker> {
  const indice = indexarColumnas(propuesta)
  const resultado: ResultadoTracker = {
    sitiosEscritos: 0,
    seguimientosEscritos: 0,
    filasOmitidas: 0,
    fueraDeOrden: 0,
    problemas: new Map(),
    error: null,
  }

  let lote = writeBatch(db)
  let operaciones = 0

  const cerrarLote = async () => {
    if (operaciones === 0) return
    await lote.commit()
    lote = writeBatch(db)
    operaciones = 0
  }

  try {
    for (const [i, cruda] of filas.entries()) {
      const fila: FilaTracker = convertirFila(cruda, propuesta, indice, homologacion)

      for (const p of fila.problemas) {
        const columna = p.split(':')[0] ?? p
        resultado.problemas.set(columna, (resultado.problemas.get(columna) ?? 0) + 1)
      }

      // Sin ID no hay nada que guardar: el id del sitio es la llave del maestro.
      if (fila.sitio.id === '') {
        resultado.filasOmitidas++
        continue
      }
      if (avanceFueraDeOrden(fila).length > 0) resultado.fueraDeOrden++

      const sellos = {
        actualizadoEn: serverTimestamp(),
        actualizadoPor: actor.uid,
      }

      lote.set(
        doc(db, COLECCIONES.sitios, fila.sitio.id),
        {
          nombre: fila.sitio.nombre || fila.sitio.id,
          region: fila.sitio.region,
          comuna: fila.sitio.comuna,
          direccion: fila.sitio.direccion,
          lat: fila.sitio.lat ?? 0,
          lon: fila.sitio.lon ?? 0,
          activo: true,
          creadoEn: serverTimestamp(),
          creadoPor: actor.uid,
          ...sellos,
        },
        { merge: true },
      )
      resultado.sitiosEscritos++
      operaciones++

      const gates = construirGates(fila, {
        responsableUid: null,
        proveedorId: destino.proveedorId,
      })
      const actual = gates[fila.etapaActual]

      lote.set(
        doc(db, COLECCIONES.sitioProyectos, idSitioProyecto(destino.proyectoId, fila.sitio.id)),
        {
          sitioId: fila.sitio.id,
          proyectoId: destino.proyectoId,
          programaId: destino.programaId,
          portafolioId: destino.portafolioId,
          celulaId: destino.celulaId,
          proveedorId: destino.proveedorId,
          responsableUid: null,
          sitioNombre: fila.sitio.nombre || fila.sitio.id,
          region: fila.sitio.region,
          comuna: fila.sitio.comuna,
          lat: fila.sitio.lat ?? 0,
          lon: fila.sitio.lon ?? 0,
          gateActual: fila.etapaActual,
          estadoGate: fila.etapaActual === 'CERRADO' ? 'completado' : 'en_curso',
          bloqueado: false,
          motivoBloqueo: null,
          prioridad: destino.prioridad,
          fechaPlanGateActual: (actual?.fechaPlan as string | null) ?? null,
          gates,
          valores: fila.valores,
          gateTemplateId: destino.plantillaId,
          gateTemplateVersion: destino.plantillaVersion,
          creadoEn: serverTimestamp(),
          creadoPor: actor.uid,
          ...sellos,
        },
        { merge: true },
      )
      resultado.seguimientosEscritos++
      operaciones++

      if (operaciones >= MAX_OPERACIONES) await cerrarLote()
      onAvance?.({ procesadas: i + 1, total: filas.length })
    }

    await cerrarLote()

    // La auditoria de la importacion va en su propio lote: es un solo evento y
    // no tiene sentido arriesgar que el ultimo lote de datos falle por el.
    const cierre = writeBatch(db)
    agregarEventos(
      cierre,
      [
        {
          entidadTipo: 'sitioProyecto',
          entidadId: destino.proyectoId,
          sitioId: null,
          proyectoId: destino.proyectoId,
          programaId: destino.programaId,
          accion: 'importar',
          campo: null,
          valorAnterior: null,
          valorNuevo: String(resultado.seguimientosEscritos),
          detalle: `Tracker importado: ${resultado.seguimientosEscritos} sitios, ${propuesta.etapas.length} etapas`,
        },
      ],
      actor,
      'import',
    )
    await cierre.commit()
  } catch (e) {
    resultado.error = e instanceof Error ? e.message : String(e)
    // Re-importar sobre seguimientos que ya existen es una actualizacion, y las
    // reglas solo dejan a jefe y analista mover cada sitio UNA etapa. Si el
    // tracker trae un sitio que salto varias, el lote completo se rechaza.
    if (actor.rol !== 'admin' && /permission|permisos|insufficient/i.test(resultado.error)) {
      resultado.error =
        'El servidor rechazo un lote. Lo mas probable es que algun sitio ya cargado avance o ' +
        'retroceda mas de una etapa respecto de lo que dice el tracker: eso solo lo puede ' +
        're-importar un administrador (o corregirse sitio por sitio). Lo escrito antes del ' +
        'error quedo guardado. Detalle: ' +
        resultado.error
    }
  }

  return resultado
}
