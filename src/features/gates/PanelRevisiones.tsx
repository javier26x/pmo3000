import { MessageSquare } from 'lucide-react'
import { formatearFecha } from '@/domain/fechas'
import {
  clasificarEstado,
  COLOR_ESTADO,
  NOMBRES_ESTADO,
  type EstadoSemantico,
} from '@/domain/tracker/estados'
import type { GateSitio } from '@/domain/tipos/sitioProyecto'
import type { GatePlantilla } from '@/domain/tipos/gate'
import { EstadoVacio, cn } from '@/components/ui'

/**
 * Quien revisa una etapa y que dijo.
 *
 * Es la vista que el Excel no puede dar: en la planilla, el estado de RF, su
 * comentario y su fecha estan en tres columnas separadas por veinte celdas, y
 * para leer una etapa completa hay que hacer scroll horizontal cruzando la
 * pantalla. Aca la etapa se lee de una.
 */
export function PanelRevisiones({
  gate,
  definicion,
  homologacion,
  responde,
}: {
  gate: GateSitio
  definicion: GatePlantilla | undefined
  homologacion: Readonly<Record<string, EstadoSemantico>>
  /** Quienes responden por el area de esa revision, o null si no hay area. */
  responde?: (revision: { id: string; nombre: string }) => string | null
}) {
  const definidas = definicion?.revisiones ?? []
  // Se muestran las de la plantilla, y ademas cualquiera que el documento traiga
  // y la plantilla ya no tenga: un dato importado no se esconde porque alguien
  // haya editado la plantilla despues.
  const huerfanas = Object.keys(gate.revisiones).filter((id) => !definidas.some((d) => d.id === id))
  const filas = [
    ...definidas.map((d) => ({ id: d.id, nombre: d.nombre })),
    ...huerfanas.map((id) => ({ id, nombre: id })),
  ]

  if (filas.length === 0) {
    return (
      <EstadoVacio
        titulo="Esta etapa no tiene revisiones por disciplina"
        descripcion="Su avance se sigue con el checklist."
      />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-borde">
      {filas.map(({ id, nombre }) => {
        const rev = gate.revisiones[id]
        const texto = rev?.estado ?? ''
        const clase = clasificarEstado(texto, homologacion)
        return (
          <li key={id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 shrink-0 text-sm font-medium">{nombre}</span>
              <span
                className={cn(
                  `gate-${COLOR_ESTADO[clase]}`,
                  'insignia-gate inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold',
                )}
                title={NOMBRES_ESTADO[clase]}
              >
                {texto === '' ? 'Sin dato' : texto}
              </span>
              {rev?.fecha != null && (
                <span className="text-xs text-texto-3">{formatearFecha(rev.fecha)}</span>
              )}
              {responde && (
                <span className="ml-auto text-xs text-texto-3">
                  {responde({ id, nombre }) ?? ''}
                </span>
              )}
            </div>
            {rev?.comentario !== undefined && rev.comentario !== '' && (
              <p className="flex items-start gap-1.5 pl-1 text-xs whitespace-pre-line text-texto-2">
                <MessageSquare aria-hidden className="mt-0.5 size-3 shrink-0 text-texto-3" />
                {rev.comentario}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
