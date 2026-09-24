import { ArrowRight, History } from 'lucide-react'
import { Cargando, EstadoVacio, Insignia } from '@/components/ui'
import { formatearFechaHora } from '@/domain/fechas'
import { NOMBRES_ACCION, type EventoAuditoria } from '@/domain/tipos/auditoria'

const TONO_ACCION = {
  cambio_gate: 'ok',
  retroceso_gate: 'riesgo',
  crear: 'info',
  eliminar: 'error',
  checklist: 'neutro',
  actualizar: 'neutro',
  importar: 'info',
  asignar: 'neutro',
} as const

/**
 * Historial de auditoria. La coleccion es append-only por reglas de Firestore:
 * lo que aparece aqui no se puede editar ni borrar, ni por un administrador.
 */
export function Historial({
  eventos,
  cargando,
  error,
}: {
  eventos: EventoAuditoria[]
  cargando: boolean
  error: string | null
}) {
  if (cargando && eventos.length === 0) return <Cargando texto="Cargando historial…" />
  if (error) return <p className="px-2 py-4 text-sm text-[var(--error-fg)]">{error}</p>

  if (eventos.length === 0) {
    return (
      <EstadoVacio
        icono={<History aria-hidden className="size-6" />}
        titulo="Sin movimientos registrados"
        descripcion="Cada cambio de etapa, fecha, responsable o entregable queda aqui."
      />
    )
  }

  return (
    <ol className="flex flex-col divide-y divide-borde">
      {eventos.map((evento) => (
        <li key={evento.id} className="px-1 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Insignia tono={TONO_ACCION[evento.accion] ?? 'neutro'}>
              {NOMBRES_ACCION[evento.accion]}
            </Insignia>
            {evento.campo && (
              <span className="font-mono text-[11px] text-texto-3">{evento.campo}</span>
            )}
            <span className="flex-1" />
            <span className="text-[11px] text-texto-3">{formatearFechaHora(evento.ts)}</span>
          </div>

          {(evento.valorAnterior || evento.valorNuevo) && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-texto-3 line-through">{evento.valorAnterior ?? '—'}</span>
              <ArrowRight aria-hidden className="size-3 text-texto-3" />
              <span className="font-medium">{evento.valorNuevo ?? '—'}</span>
            </p>
          )}

          {evento.detalle && <p className="mt-0.5 text-xs text-texto-2">{evento.detalle}</p>}

          <p className="mt-0.5 text-[11px] text-texto-3">
            {evento.nombre || evento.email}
            {evento.origen !== 'ui' && ` · ${evento.origen}`}
          </p>
        </li>
      ))}
    </ol>
  )
}
