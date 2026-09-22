import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  contarSeguimientosDeProyecto,
  eliminarSeguimientosDeProyecto,
  type AvanceEliminacion,
} from '@/data/repos/sitioProyectos'
import { mensajeDeError, usarAvisos } from '@/app/avisos'
import { usarPausaDespliegue } from '@/app/despliegue'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { puedeCorregirComoAdmin } from '@/domain/gates/maquina'
import {
  AreaTexto,
  Aviso,
  BarraProgreso,
  Boton,
  Campo,
  Cargando,
  Dialogo,
  Entrada,
  Selector,
} from '@/components/ui'

/**
 * Deshacer una importacion: elimina TODOS los seguimientos de un proyecto, con
 * sus comentarios, y deja un evento de auditoria por cada uno. Solo admin: las
 * reglas lo exigen igual.
 *
 * Los sitios del maestro no se tocan (pueden estar en otros proyectos), y la
 * plantilla tampoco: se administra en Configuracion.
 */
export function EliminarSeguimientosProyecto(props: {
  /** Para ofrecer "deshacer" justo despues de importar. */
  proyectoInicial?: string
}) {
  const actor = useActor()
  if (!puedeCorregirComoAdmin(actor)) return null
  // La key reinicia el formulario si cambia el proyecto sugerido.
  return <Formulario key={props.proyectoInicial ?? ''} {...props} />
}

function Formulario({ proyectoInicial = '' }: { proyectoInicial?: string }) {
  const actor = useActor()
  const { proyectos } = useCatalogos()
  const mostrar = usarAvisos((e) => e.mostrar)
  const pausar = usarPausaDespliegue((e) => e.pausar)
  const reanudar = usarPausaDespliegue((e) => e.reanudar)

  const [proyectoId, setProyectoId] = useState(proyectoInicial)
  // El conteo se guarda junto a la consulta que lo produjo: asi "contando" se
  // deriva (no hay un conteo para la consulta vigente) en vez de encenderse a
  // mano dentro del efecto.
  const [lectura, setLectura] = useState<{
    clave: string
    conteo: number | null
    error: string | null
  } | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [avance, setAvance] = useState<AvanceEliminacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  const clave = `${proyectoId}#${recarga}`
  useEffect(() => {
    if (proyectoId === '') return
    let vigente = true
    contarSeguimientosDeProyecto(proyectoId)
      .then((n) => vigente && setLectura({ clave, conteo: n, error: null }))
      .catch((e) => vigente && setLectura({ clave, conteo: null, error: mensajeDeError(e) }))
    return () => {
      vigente = false
    }
  }, [proyectoId, clave])

  const vigente = proyectoId !== '' && lectura?.clave === clave ? lectura : null
  const contando = proyectoId !== '' && vigente === null
  const conteo = vigente?.conteo ?? null
  const errorConteo = vigente?.error ?? null

  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? null
  const trabajando = avance !== null
  const confirmado = proyecto !== null && confirmacion.trim() === proyecto.id

  const eliminar = async () => {
    if (!proyecto || !confirmado || !motivo.trim()) return
    setError(null)
    setAvance({ fase: 'leyendo', hechos: 0, total: conteo ?? 0 })
    // Igual que al importar: sin pausar, cada lote borrado repinta toda la app.
    pausar()
    try {
      const r = await eliminarSeguimientosDeProyecto(proyecto.id, motivo, actor, setAvance)
      mostrar(
        'ok',
        `${r.seguimientos} seguimientos de ${proyecto.nombre} eliminados` +
          (r.comentarios > 0 ? ` (con ${r.comentarios} comentarios).` : '.'),
      )
      setAbierto(false)
      setMotivo('')
      setConfirmacion('')
    } catch (e) {
      setError(
        `${mensajeDeError(e)}. Lo borrado hasta el error quedó borrado y auditado; volver a ` +
          'ejecutar termina el trabajo.',
      )
    } finally {
      reanudar()
      setAvance(null)
      setRecarga((n) => n + 1)
    }
  }

  const porcentaje = avance && avance.total > 0 ? (avance.hechos / avance.total) * 100 : 0

  return (
    <section
      aria-labelledby="titulo-eliminar-proyecto"
      className="rounded-lg border border-[var(--error-fg)]/30 bg-superficie p-3"
    >
      <h3 id="titulo-eliminar-proyecto" className="mb-1 flex items-center gap-2 text-md">
        <Trash2 aria-hidden className="size-4 text-[var(--error-fg)]" />
        Deshacer / eliminar seguimientos de un proyecto
      </h3>
      <p className="mb-3 text-xs text-texto-2">
        Solo administradores. Borra todos los seguimientos del proyecto y sus comentarios, por
        ejemplo para deshacer una importación equivocada. Cada eliminación queda en la auditoría.
        Los sitios del maestro y la plantilla no se tocan.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Proyecto" htmlFor="proy-eliminar">
          <Selector
            id="proy-eliminar"
            value={proyectoId}
            disabled={trabajando}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Elige un proyecto…</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <div className="pb-2 text-sm" aria-live="polite">
          {contando ? (
            <Cargando texto="Contando…" />
          ) : errorConteo ? (
            <span className="text-[var(--error-fg)]">{errorConteo}</span>
          ) : conteo !== null ? (
            <span>
              <strong className="tabular-nums">{conteo}</strong> seguimientos en este proyecto
            </span>
          ) : null}
        </div>
        <Boton
          variante="peligro"
          disabled={proyecto === null || !conteo || trabajando}
          icono={<Trash2 aria-hidden className="size-4" />}
          onClick={() => {
            setMotivo('')
            setConfirmacion('')
            setError(null)
            setAbierto(true)
          }}
        >
          Eliminar seguimientos…
        </Boton>
      </div>

      <Dialogo
        abierto={abierto}
        onCerrar={() => !trabajando && setAbierto(false)}
        titulo={`Eliminar ${conteo ?? 0} seguimientos`}
        descripcion={
          proyecto
            ? `Se borran todos los seguimientos de ${proyecto.nombre} y sus comentarios. No se puede deshacer; la auditoría conserva el rastro.`
            : undefined
        }
        pie={
          <>
            <Boton disabled={trabajando} onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={!confirmado || !motivo.trim() || trabajando}
              onClick={() => void eliminar()}
            >
              Eliminar definitivamente
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <Aviso tono="error" titulo="La eliminación se detuvo">
              {error}
            </Aviso>
          )}
          <Campo etiqueta="Motivo" htmlFor="motivo-eliminar-proyecto" obligatorio>
            <AreaTexto
              id="motivo-eliminar-proyecto"
              value={motivo}
              disabled={trabajando}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se importó el tracker en el proyecto equivocado."
            />
          </Campo>
          <Campo
            etiqueta={`Escribe ${proyecto?.id ?? ''} para confirmar`}
            htmlFor="confirmar-eliminar-proyecto"
            obligatorio
            ayuda="Es el identificador del proyecto, no su nombre."
          >
            <Entrada
              id="confirmar-eliminar-proyecto"
              value={confirmacion}
              disabled={trabajando}
              autoComplete="off"
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </Campo>
          {avance && (
            <div>
              <p className="mb-1 text-xs text-texto-2">
                {avance.fase === 'leyendo'
                  ? `Leyendo comentarios: ${avance.hechos} de ${avance.total}…`
                  : `Escribiendo lote ${avance.hechos} de ${avance.total}…`}
              </p>
              <BarraProgreso valor={porcentaje} />
            </div>
          )}
        </div>
      </Dialogo>
    </section>
  )
}
