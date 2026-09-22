/**
 * Escritura de la importacion del maestro de sitios.
 *
 * Firestore permite 500 operaciones por writeBatch. Cada fila puede escribir dos
 * documentos (el sitio y su seguimiento), asi que los lotes se arman por
 * operaciones, no por filas. Si un lote falla, el proceso se detiene y reporta
 * hasta donde alcanzo: volver a correr la importacion es seguro porque el id del
 * sitio y el del seguimiento son deterministas (no se duplica nada).
 */
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { COLECCIONES, db } from '../firebase'
import { agregarEventos } from '../auditoria'
import { prepararSeguimiento, seguimientosExistentes } from './sitioProyectos'
import { idSitioProyecto } from '@/domain/tipos/sitioProyecto'
import { estaEnAlcance } from '@/domain/permisos/alcance'
import type { FilaImportacion } from '@/domain/importacion/validacion'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { Actor, Prioridad } from '@/domain/tipos/comunes'

// Firestore admite 500 operaciones por lote, pero tambien limita el tamano
// total, que incluye las entradas de indice: con seguimientos que traen todas
// sus etapas embebidas, 450 escrituras pueden pasarse ("Transaction too big").
const MAX_OPERACIONES = 200

/** Destino al que se incorpora un sitio cuando la fila trae columna Programa. */
export interface DestinoPrograma {
  programaId: string
  proyectoId: string
  portafolioId: string
  celulaId: string | null
  plantilla: GateTemplate
}

export interface ContextoImportacion {
  /** Programa normalizado en minusculas -> destino. */
  destinos: Map<string, DestinoPrograma>
  /** Proveedor normalizado en minusculas -> id. */
  proveedores: Map<string, string>
  prioridad: Prioridad
  /** Si la fila no trae programa, se usa este destino (opcional). */
  destinoPorDefecto: DestinoPrograma | null
}

export interface ResultadoImportacion {
  sitiosEscritos: number
  seguimientosCreados: number
  /** Seguimientos que ya existian: se actualizan los datos del sitio, no el avance. */
  seguimientosActualizados: number
  /**
   * Seguimientos que no se escribieron porque su destino queda fuera del
   * alcance de quien importa. Las reglas los rechazarian y, con ellos, el lote
   * completo; se saltan y se informan.
   */
  seguimientosFueraDeAlcance: number
  filasOmitidas: number
  programasNoEncontrados: string[]
  proveedoresNoEncontrados: string[]
  error: string | null
}

export interface AvanceImportacion {
  procesadas: number
  total: number
}

const normalizar = (texto: string) => texto.trim().toLowerCase()

export async function ejecutarImportacion(
  filas: readonly FilaImportacion[],
  contexto: ContextoImportacion,
  actor: Actor,
  onAvance?: (avance: AvanceImportacion) => void,
): Promise<ResultadoImportacion> {
  const importables = filas.filter(
    (f) => f.sitio && (f.estado === 'nuevo' || f.estado === 'actualiza'),
  )

  const resultado: ResultadoImportacion = {
    sitiosEscritos: 0,
    seguimientosCreados: 0,
    seguimientosActualizados: 0,
    seguimientosFueraDeAlcance: 0,
    filasOmitidas: filas.length - importables.length,
    programasNoEncontrados: [],
    proveedoresNoEncontrados: [],
    error: null,
  }

  const programasFaltantes = new Set<string>()
  const proveedoresFaltantes = new Set<string>()

  const destinoDe = (fila: FilaImportacion) =>
    fila.programa ? contexto.destinos.get(normalizar(fila.programa)) : contexto.destinoPorDefecto

  let batch = writeBatch(db)
  let operaciones = 0
  let procesadas = 0

  const confirmar = async () => {
    if (operaciones === 0) return
    await batch.commit()
    batch = writeBatch(db)
    operaciones = 0
  }

  try {
    // Un seguimiento que ya existe no se vuelve a armar desde la plantilla: un
    // set con merge pisaria gateActual y el mapa de gates, y el sitio volveria a
    // la primera etapa. Se averigua antes cuales existen para tocarles solo los
    // datos del sitio.
    const candidatos = new Set<string>()
    for (const fila of importables) {
      const destino = destinoDe(fila)
      if (fila.sitio && destino && estaEnAlcance(actor, destino)) {
        candidatos.add(idSitioProyecto(destino.proyectoId, fila.sitio.id))
      }
    }
    const existentes = await seguimientosExistentes([...candidatos])

    for (const fila of importables) {
      const sitio = fila.sitio
      if (!sitio) continue

      const { id, ...campos } = sitio
      const esNuevo = fila.estado === 'nuevo'

      batch.set(
        doc(db, COLECCIONES.sitios, id),
        {
          ...campos,
          ...(esNuevo ? { creadoEn: serverTimestamp(), creadoPor: actor.uid } : {}),
          actualizadoEn: serverTimestamp(),
          actualizadoPor: actor.uid,
        },
        { merge: true },
      )
      operaciones += 1
      resultado.sitiosEscritos += 1

      const destino = destinoDe(fila)
      if (fila.programa && !destino) programasFaltantes.add(fila.programa)

      let proveedorId: string | null = null
      if (fila.proveedor) {
        proveedorId = contexto.proveedores.get(normalizar(fila.proveedor)) ?? null
        if (!proveedorId) proveedoresFaltantes.add(fila.proveedor)
      }

      if (destino && !estaEnAlcance(actor, destino)) {
        resultado.seguimientosFueraDeAlcance += 1
      } else if (destino && existentes.has(idSitioProyecto(destino.proyectoId, id))) {
        // Solo la copia desnormalizada del sitio: el avance y las asignaciones
        // quedan como estan.
        batch.update(doc(db, COLECCIONES.sitioProyectos, idSitioProyecto(destino.proyectoId, id)), {
          sitioNombre: sitio.nombre,
          region: sitio.region,
          comuna: sitio.comuna,
          lat: sitio.lat,
          lon: sitio.lon,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: actor.uid,
        })
        operaciones += 1
        resultado.seguimientosActualizados += 1
      } else if (destino) {
        const preparado = prepararSeguimiento({
          sitio: {
            id,
            nombre: sitio.nombre,
            region: sitio.region,
            comuna: sitio.comuna,
            lat: sitio.lat,
            lon: sitio.lon,
          },
          proyectoId: destino.proyectoId,
          programaId: destino.programaId,
          portafolioId: destino.portafolioId,
          celulaId: destino.celulaId,
          proveedorId,
          responsableUid: null,
          plantilla: destino.plantilla,
          fechaInicio: fila.fechaInicio,
          prioridad: contexto.prioridad,
        })

        batch.set(doc(db, COLECCIONES.sitioProyectos, preparado.id), {
          ...preparado.documento,
          creadoEn: serverTimestamp(),
          creadoPor: actor.uid,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: actor.uid,
        })
        operaciones += 1
        resultado.seguimientosCreados += 1
      }

      procesadas += 1

      if (operaciones >= MAX_OPERACIONES) {
        await confirmar()
        onAvance?.({ procesadas, total: importables.length })
      }
    }

    await confirmar()
    onAvance?.({ procesadas, total: importables.length })

    // Un solo evento por importacion: 4.500 eventos no le sirven a nadie y
    // reventarian el lote. El detalle del archivo queda en el evento.
    const cierre = writeBatch(db)
    agregarEventos(
      cierre,
      [
        {
          entidadTipo: 'importacion',
          entidadId: `import-${Date.now()}`,
          sitioId: null,
          proyectoId: null,
          programaId: null,
          accion: 'importar',
          campo: null,
          valorAnterior: null,
          valorNuevo: String(resultado.sitiosEscritos),
          detalle: `${resultado.sitiosEscritos} sitio(s) escrito(s), ${resultado.seguimientosCreados} seguimiento(s) nuevo(s), ${resultado.seguimientosActualizados} actualizado(s), ${resultado.filasOmitidas} fila(s) omitida(s)${resultado.seguimientosFueraDeAlcance ? `, ${resultado.seguimientosFueraDeAlcance} seguimiento(s) fuera de alcance` : ''}`,
        },
      ],
      actor,
      'import',
    )
    await cierre.commit()
  } catch (e) {
    resultado.error = e instanceof Error ? e.message : 'Error desconocido al escribir'
  }

  resultado.programasNoEncontrados = [...programasFaltantes]
  resultado.proveedoresNoEncontrados = [...proveedoresFaltantes]
  return resultado
}
