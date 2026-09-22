import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, History, Lock } from 'lucide-react'
import {
  Aviso,
  CabeceraPantalla,
  Cargando,
  Celda,
  Encabezado,
  Entrada,
  EstadoVacio,
  Insignia,
  Selector,
} from '@/components/ui'
import { observarAuditoria } from '@/data/repos/auditoria'
import { formatearFechaHora } from '@/domain/fechas'
import { NOMBRES_ACCION, type EventoAuditoria } from '@/domain/tipos/auditoria'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useSuscripcion } from '@/hooks/useSuscripcion'

const SIN_EVENTOS: EventoAuditoria[] = []
const TOPE = 300

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

export function PaginaAuditoria() {
  const { programas, usuarios } = useCatalogos()
  const [programaId, setProgramaId] = useState('')
  const [uid, setUid] = useState('')
  const [sitioId, setSitioId] = useState('')

  const clave = `${programaId}|${uid}|${sitioId.trim()}`
  const suscribir = useCallback(
    (cb: (d: EventoAuditoria[]) => void, onError: (e: Error) => void) => {
      const [prog, usuario, sitio] = clave.split('|')
      return observarAuditoria(
        {
          programaId: prog || null,
          uid: usuario || null,
          sitioId: sitio || null,
        },
        TOPE,
        cb,
        onError,
      )
    },
    [clave],
  )

  const { datos, cargando, error } = useSuscripcion(suscribir, SIN_EVENTOS)

  return (
    <>
      <CabeceraPantalla
        titulo="Auditoria"
        descripcion="Cada cambio de gate, fecha, responsable o entregable, con quien lo hizo y cuando."
        acciones={
          <Insignia tono="neutro">
            <Lock aria-hidden className="size-3" />
            Registro inalterable
          </Insignia>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="w-56">
            <Entrada
              value={sitioId}
              onChange={(e) => setSitioId(e.target.value)}
              placeholder="ID de sitio exacto…"
              aria-label="Filtrar por ID de sitio"
            />
          </div>
          <div className="w-48">
            <Selector
              value={programaId}
              onChange={(e) => setProgramaId(e.target.value)}
              aria-label="Filtrar por programa"
            >
              <option value="">Todos los programas</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </div>
          <div className="w-44">
            <Selector
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              aria-label="Filtrar por persona"
            >
              <option value="">Todas las personas</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
          </div>
          <span className="text-xs text-texto-3">Ultimos {TOPE} eventos que cumplen el filtro</span>
        </div>
      </CabeceraPantalla>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {error && (
          <Aviso tono="error" titulo="No pudimos cargar la auditoria" className="mb-3">
            {error}
          </Aviso>
        )}

        {cargando && datos.length === 0 ? (
          <Cargando texto="Cargando eventos…" />
        ) : datos.length === 0 ? (
          <EstadoVacio
            icono={<History aria-hidden className="size-8" />}
            titulo="Sin eventos para este filtro"
            descripcion="Prueba quitando filtros, o genera actividad avanzando un gate."
          />
        ) : (
          <div className="panel-scroll min-h-0 flex-1 overflow-auto rounded border border-borde bg-superficie">
            <table className="w-full border-collapse">
              <caption className="sr-only">Registro de auditoria</caption>
              <thead>
                <tr>
                  <Encabezado>Fecha y hora</Encabezado>
                  <Encabezado>Accion</Encabezado>
                  <Encabezado>Sitio</Encabezado>
                  <Encabezado>Campo</Encabezado>
                  <Encabezado>Cambio</Encabezado>
                  <Encabezado>Detalle</Encabezado>
                  <Encabezado>Persona</Encabezado>
                </tr>
              </thead>
              <tbody>
                {datos.map((evento) => (
                  <tr
                    key={evento.id}
                    style={{ height: 'var(--alto-fila)' }}
                    className="border-b border-borde last:border-0 hover:bg-superficie-2"
                  >
                    <Celda className="text-texto-2 tabular-nums">
                      {formatearFechaHora(evento.ts)}
                    </Celda>
                    <Celda>
                      <Insignia tono={TONO_ACCION[evento.accion] ?? 'neutro'}>
                        {NOMBRES_ACCION[evento.accion]}
                      </Insignia>
                    </Celda>
                    <Celda className="font-mono text-xs">
                      {evento.sitioId ? (
                        <Link
                          to={`/sitios/${encodeURIComponent(evento.sitioId)}`}
                          className="rounded text-[var(--acento)] hover:underline"
                        >
                          {evento.sitioId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Celda>
                    <Celda
                      className="max-w-52 font-mono text-[11px] text-texto-2"
                      titulo={evento.campo ?? ''}
                    >
                      {evento.campo ?? '—'}
                    </Celda>
                    <Celda className="max-w-52">
                      {evento.valorAnterior || evento.valorNuevo ? (
                        <span className="flex items-center gap-1 text-xs">
                          <span className="truncate text-texto-3 line-through">
                            {evento.valorAnterior ?? '—'}
                          </span>
                          <ArrowRight aria-hidden className="size-3 shrink-0 text-texto-3" />
                          <span className="truncate font-medium">{evento.valorNuevo ?? '—'}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </Celda>
                    <Celda className="max-w-64 text-xs text-texto-2" titulo={evento.detalle ?? ''}>
                      {evento.detalle ?? '—'}
                    </Celda>
                    <Celda className="max-w-40 text-texto-2" titulo={evento.email}>
                      {evento.nombre || evento.email}
                    </Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
