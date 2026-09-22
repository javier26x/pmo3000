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
import { prepararSeguimiento } from './sitioProyectos'
import type { FilaImportacion } from '@/domain/importacion/validacion'
import type { GateTemplate } from '@/domain/tipos/gate'
import type { Actor, Prioridad } from '@/domain/tipos/comunes'

const MAX_OPERACIONES = 450

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
    filasOmitidas: filas.length - importables.length,
    programasNoEncontrados: [],
    proveedoresNoEncontrados: [],
    error: null,
  }

  const programasFaltantes = new Set<string>()
  const proveedoresFaltantes = new Set<string>()

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

      const destino = fila.programa
        ? contexto.destinos.get(normalizar(fila.programa))
        : contexto.destinoPorDefecto
      if (fila.programa && !destino) programasFaltantes.add(fila.programa)

      let proveedorId: string | null = null
      if (fila.proveedor) {
        proveedorId = contexto.proveedores.get(normalizar(fila.proveedor)) ?? null
        if (!proveedorId) proveedoresFaltantes.add(fila.proveedor)
      }

      if (destino) {
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

        // merge deja intacto el avance de un seguimiento que ya exista: una
        // reimportacion actualiza los datos del sitio sin pisar sus gates.
        batch.set(
          doc(db, COLECCIONES.sitioProyectos, preparado.id),
          {
            ...preparado.documento,
            creadoEn: serverTimestamp(),
            creadoPor: actor.uid,
            actualizadoEn: serverTimestamp(),
            actualizadoPor: actor.uid,
          },
          { merge: true },
        )
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
          detalle: `${resultado.sitiosEscritos} sitio(s) escrito(s), ${resultado.seguimientosCreados} seguimiento(s), ${resultado.filasOmitidas} fila(s) omitida(s)`,
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
