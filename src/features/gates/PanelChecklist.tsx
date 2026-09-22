import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Aviso, Boton, Campo, Casilla, Entrada, Insignia, cn } from '@/components/ui'
import { formatearFecha, formatearFechaHora } from '@/domain/fechas'
import { ordenGate, type CodigoGate } from '@/domain/gates/catalogo'
import { gateDePlantilla, type GateTemplate } from '@/domain/tipos/gate'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'

export interface AccionChecklist {
  codigo: CodigoGate
  itemId: string
  ok: boolean
  evidenciaUrl?: string
  obs?: string
}

/**
 * Checklist de entregables del gate. Un item obligatorio con evidencia exigida no
 * se puede marcar sin la URL: la regla vive en el dominio, aqui solo se muestra.
 */
export function PanelChecklist({
  sp,
  plantilla,
  codigo,
  editable,
  onMarcar,
  onEditarFecha,
}: {
  sp: SitioProyecto
  plantilla: GateTemplate
  codigo: CodigoGate
  editable: boolean
  onMarcar: (accion: AccionChecklist) => void
  onEditarFecha: (campo: 'fechaPlan' | 'fechaReal', valor: string | null) => void
}) {
  const definicion = gateDePlantilla(plantilla, codigo)
  const gate = sp.gates[codigo]
  const [evidenciaEnEdicion, setEvidenciaEnEdicion] = useState<string | null>(null)
  const [urlBorrador, setUrlBorrador] = useState('')

  const esFuturo = ordenGate(codigo) > ordenGate(sp.gateActual)
  const puedeEditar = editable && !esFuturo

  if (!definicion) {
    return (
      <Aviso tono="riesgo">
        El gate {codigo} no existe en la plantilla {plantilla.id} v{plantilla.version}.
      </Aviso>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo
          etiqueta="Fecha plan"
          htmlFor={`plan-${codigo}`}
          ayuda={
            gate?.fechaPlan ? `Comprometida: ${formatearFecha(gate.fechaPlan)}` : 'Sin fecha plan'
          }
        >
          <Entrada
            id={`plan-${codigo}`}
            type="date"
            value={gate?.fechaPlan ?? ''}
            disabled={!editable}
            onChange={(e) => onEditarFecha('fechaPlan', e.target.value || null)}
          />
        </Campo>
        <Campo
          etiqueta="Fecha real"
          htmlFor={`real-${codigo}`}
          ayuda={
            gate?.fechaReal ? `Cerrado el ${formatearFecha(gate.fechaReal)}` : 'Aun sin cierre'
          }
        >
          <Entrada
            id={`real-${codigo}`}
            type="date"
            value={gate?.fechaReal ?? ''}
            disabled={!puedeEditar}
            onChange={(e) => onEditarFecha('fechaReal', e.target.value || null)}
          />
        </Campo>
      </div>

      {esFuturo && (
        <Aviso tono="info">
          Este gate todavia no esta en curso. Se puede consultar, pero no editar.
        </Aviso>
      )}

      <ul className="flex flex-col divide-y divide-borde rounded border border-borde">
        {definicion.checklist.map((item) => {
          const marcado = gate?.checklist?.[item.id]
          const cumplido = marcado?.ok ?? false
          const faltaEvidencia = item.requiereEvidencia && !marcado?.evidenciaUrl?.trim()
          const editandoEste = evidenciaEnEdicion === item.id

          return (
            <li key={item.id} className="px-2.5 py-2">
              <div className="flex items-start gap-2">
                <Casilla
                  etiqueta={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-sm', cumplido && 'text-texto-2')}>
                        {item.texto}
                      </span>
                      {!item.obligatorio && <Insignia tono="neutro">opcional</Insignia>}
                      {item.requiereEvidencia && (
                        <Insignia tono={faltaEvidencia ? 'riesgo' : 'ok'}>
                          <Paperclip aria-hidden className="size-3" />
                          evidencia
                        </Insignia>
                      )}
                    </span>
                  }
                  checked={cumplido}
                  disabled={!puedeEditar}
                  onChange={(e) =>
                    onMarcar({
                      codigo,
                      itemId: item.id,
                      ok: e.target.checked,
                      ...(marcado?.evidenciaUrl ? { evidenciaUrl: marcado.evidenciaUrl } : {}),
                    })
                  }
                  className="min-w-0 flex-1"
                />
              </div>

              <div className="mt-1 ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-3">
                {marcado?.en && marcado.por && (
                  <span>Marcado el {formatearFechaHora(marcado.en)}</span>
                )}
                {marcado?.evidenciaUrl && (
                  <a
                    href={marcado.evidenciaUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded text-[var(--acento)] hover:underline"
                  >
                    Ver evidencia
                  </a>
                )}
                {item.requiereEvidencia && puedeEditar && !editandoEste && (
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenciaEnEdicion(item.id)
                      setUrlBorrador(marcado?.evidenciaUrl ?? '')
                    }}
                    className="rounded text-texto-2 underline hover:text-texto"
                  >
                    {marcado?.evidenciaUrl ? 'Cambiar evidencia' : 'Adjuntar evidencia'}
                  </button>
                )}
              </div>

              {editandoEste && (
                <div className="mt-1.5 ml-6 flex flex-wrap items-end gap-2">
                  <Campo
                    etiqueta="URL de la evidencia"
                    htmlFor={`evi-${item.id}`}
                    ayuda="Enlace al documento en SharePoint o al repositorio de la PMO."
                    className="min-w-56 flex-1"
                  >
                    <Entrada
                      id={`evi-${item.id}`}
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={urlBorrador}
                      onChange={(e) => setUrlBorrador(e.target.value)}
                    />
                  </Campo>
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={() => {
                      onMarcar({
                        codigo,
                        itemId: item.id,
                        ok: cumplido,
                        evidenciaUrl: urlBorrador.trim(),
                      })
                      setEvidenciaEnEdicion(null)
                    }}
                  >
                    Guardar
                  </Boton>
                  <Boton tamano="sm" onClick={() => setEvidenciaEnEdicion(null)}>
                    Cancelar
                  </Boton>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
