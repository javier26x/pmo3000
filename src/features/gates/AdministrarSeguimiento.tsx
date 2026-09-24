import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Shuffle, ShieldAlert, Trash2, Users } from 'lucide-react'
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Dialogo,
  Entrada,
  ItemMenu,
  Menu,
  Selector,
  TituloMenu,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { aplicarParche, eliminarSeguimiento } from '@/data/repos/sitioProyectos'
import { hoyEnChile } from '@/domain/fechas'
import { CERRADO, nombreGate, secuenciaDeGates, type GateActual } from '@/domain/gates/catalogo'
import {
  contextoDe,
  planCambiarCelula,
  planCorreccionAdmin,
  puedeCorregirComoAdmin,
  validarEliminacion,
} from '@/domain/gates/maquina'
import { NOMBRES_ESTADO_GATE } from '@/domain/tipos/comunes'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'

type DialogoAdmin = 'etapa' | 'celula' | 'eliminar' | null

/**
 * Correcciones administrativas de un seguimiento: lo que antes exigia que un
 * desarrollador editara la base. Solo admin (las reglas lo exigen igual), y
 * separado de las acciones del dia a dia para que nadie lo use por costumbre.
 */
export function AdministrarSeguimiento({ sp }: { sp: SitioProyecto }) {
  const actor = useActor()
  if (!puedeCorregirComoAdmin(actor)) return null
  return <Contenido sp={sp} />
}

function Contenido({ sp }: { sp: SitioProyecto }) {
  const actor = useActor()
  const navegar = useNavigate()
  const { etapas, celulas } = useCatalogos()

  const [dialogo, setDialogo] = useState<DialogoAdmin>(null)
  const [destino, setDestino] = useState<GateActual>(sp.gateActual)
  const [fechaReal, setFechaReal] = useState(hoyEnChile())
  const [motivo, setMotivo] = useState('')
  const [celulaId, setCelulaId] = useState(sp.celulaId ?? '')
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const hoy = hoyEnChile()
  const secuencia = secuenciaDeGates(sp.gates)
  const nombreEtapa = (g: GateActual) =>
    g === CERRADO ? nombreGate(g) : sp.gates[g]?.nombre || nombreGate(g, etapas)

  const abrir = (d: DialogoAdmin) => {
    setDestino(sp.gateActual)
    setFechaReal(hoy)
    setMotivo('')
    setCelulaId(sp.celulaId ?? '')
    setConfirmacion('')
    setDialogo(d)
  }

  const cerrar = () => {
    if (!eliminando) setDialogo(null)
  }

  // La vista previa usa el mismo plan que se va a aplicar: lo que se ve es lo
  // que se escribe.
  const plan = planCorreccionAdmin(sp, contextoDe(actor), {
    destino,
    fechaReal,
    motivo: motivo.trim() ? motivo : '-',
  })
  const posDestino = secuencia.indexOf(destino)
  const vistaPrevia = secuencia.map((codigo, i) => {
    const pos = destino === CERRADO ? secuencia.length : posDestino
    const estado = i < pos ? 'completado' : i === pos ? 'en_curso' : 'no_iniciado'
    return { codigo, antes: sp.gates[codigo]?.estado, despues: estado } as const
  })

  const corregirEtapa = () => {
    const r = planCorreccionAdmin(sp, contextoDe(actor), { destino, fechaReal, motivo })
    if (!r.ok) {
      avisar.error(r.motivo)
      return
    }
    aplicarParche(sp, r.valor, actor).catch((e) => avisar.error(mensajeDeError(e)))
    avisar.ok(`${sp.sitioId} quedó en ${nombreEtapa(destino)}`)
    setDialogo(null)
  }

  const cambiarCelula = () => {
    const r = planCambiarCelula(sp, contextoDe(actor), { celulaId: celulaId || null, motivo })
    if (!r.ok) {
      avisar.error(r.motivo)
      return
    }
    aplicarParche(sp, r.valor, actor).catch((e) => avisar.error(mensajeDeError(e)))
    avisar.ok('Célula actualizada')
    setDialogo(null)
  }

  const eliminar = async () => {
    const v = validarEliminacion(sp, actor, { confirmacion, motivo })
    if (!v.ok) {
      avisar.error(v.motivo)
      return
    }
    setEliminando(true)
    try {
      // Aca si se espera al servidor: hay que leer los comentarios para
      // borrarlos, y no tiene sentido salir de la ficha si el borrado fallo.
      const r = await eliminarSeguimiento(sp, motivo, actor)
      avisar.ok(
        `Seguimiento de ${sp.sitioId} eliminado` +
          (r.comentarios > 0 ? ` junto con ${r.comentarios} comentarios` : ''),
      )
      setDialogo(null)
      navegar(`/sitios/${encodeURIComponent(sp.sitioId)}`)
    } catch (e) {
      avisar.error(mensajeDeError(e))
    } finally {
      setEliminando(false)
    }
  }

  return (
    <>
      <Menu
        etiqueta="Administrar"
        icono={<ShieldAlert aria-hidden className="size-4" />}
        alineacion="derecha"
        ancho="w-72"
      >
        {(cerrarMenu) => (
          <>
            <TituloMenu>Corrección administrativa</TituloMenu>
            <ItemMenu
              icono={<Shuffle aria-hidden className="size-4" />}
              onClick={() => {
                cerrarMenu()
                abrir('etapa')
              }}
            >
              Mover a cualquier etapa…
            </ItemMenu>
            <ItemMenu
              icono={<Users aria-hidden className="size-4" />}
              onClick={() => {
                cerrarMenu()
                abrir('celula')
              }}
            >
              Cambiar célula…
            </ItemMenu>
            <ItemMenu
              peligro
              icono={<Trash2 aria-hidden className="size-4" />}
              onClick={() => {
                cerrarMenu()
                abrir('eliminar')
              }}
            >
              Eliminar seguimiento…
            </ItemMenu>
          </>
        )}
      </Menu>

      {/* --- Mover a cualquier etapa --- */}
      <Dialogo
        abierto={dialogo === 'etapa'}
        onCerrar={cerrar}
        ancho="lg"
        titulo="Corrección administrativa de etapa"
        descripcion="Lleva el sitio a cualquier etapa, hacia adelante o hacia atrás, sin las validaciones del avance normal. Las etapas anteriores quedan cerradas y las posteriores sin iniciar. Queda en la auditoría."
        pie={
          <>
            <Boton onClick={cerrar}>Cancelar</Boton>
            <Boton variante="peligro" disabled={!motivo.trim() || !plan.ok} onClick={corregirEtapa}>
              Aplicar corrección
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Etapa destino" htmlFor="admin-destino" obligatorio>
              <Selector
                id="admin-destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              >
                {[...secuencia, CERRADO].map((g) => (
                  <option key={g} value={g}>
                    {nombreEtapa(g)}
                    {g === sp.gateActual ? ' (actual)' : ''}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo
              etiqueta="Fecha real para las etapas que se cierran"
              htmlFor="admin-fecha"
              obligatorio
              ayuda="Solo se usa en las que no tenían fecha real; las que ya la tenían la conservan."
            >
              <Entrada
                id="admin-fecha"
                type="date"
                max={hoy}
                value={fechaReal}
                onChange={(e) => setFechaReal(e.target.value)}
              />
            </Campo>
          </div>

          <div className="rounded border border-borde">
            <table className="w-full text-sm">
              <caption className="sr-only">Estado de cada etapa antes y después</caption>
              <thead className="text-left text-[11px] text-texto-3">
                <tr>
                  <th className="px-2 py-1 font-medium">Etapa</th>
                  <th className="px-2 py-1 font-medium">Ahora</th>
                  <th className="px-2 py-1 font-medium">Queda</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.map((f) => (
                  <tr key={f.codigo} className="border-t border-borde">
                    <td className="px-2 py-1">{nombreEtapa(f.codigo)}</td>
                    <td className="px-2 py-1 text-texto-2">
                      {f.antes ? NOMBRES_ESTADO_GATE[f.antes] : '—'}
                    </td>
                    <td
                      className={
                        f.antes !== f.despues ? 'px-2 py-1 font-medium' : 'px-2 py-1 text-texto-2'
                      }
                    >
                      {NOMBRES_ESTADO_GATE[f.despues]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!plan.ok && <Aviso tono="info">{plan.motivo}</Aviso>}
          {sp.bloqueado && (
            <Aviso tono="riesgo">
              El sitio está bloqueado y sigue bloqueado después de la corrección. Desbloquéalo
              aparte si corresponde.
            </Aviso>
          )}

          <Campo etiqueta="Motivo" htmlFor="admin-motivo" obligatorio>
            <AreaTexto
              id="admin-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: el tracker del contratista estaba desfasado; se alinea con el acta."
            />
          </Campo>
        </div>
      </Dialogo>

      {/* --- Cambiar celula --- */}
      <Dialogo
        abierto={dialogo === 'celula'}
        onCerrar={cerrar}
        titulo="Cambiar la célula"
        descripcion="La célula decide qué equipo ve y gestiona el sitio en sus vistas. Queda en la auditoría."
        pie={
          <>
            <Boton onClick={cerrar}>Cancelar</Boton>
            <Boton
              variante="primario"
              disabled={(celulaId || null) === sp.celulaId}
              onClick={cambiarCelula}
            >
              Guardar
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo etiqueta="Célula" htmlFor="admin-celula">
            <Selector
              id="admin-celula"
              value={celulaId}
              onChange={(e) => setCelulaId(e.target.value)}
            >
              <option value="">Sin célula</option>
              {celulas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Motivo" htmlFor="admin-motivo-celula" ayuda="Opcional.">
            <AreaTexto
              id="admin-motivo-celula"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
        </div>
      </Dialogo>

      {/* --- Eliminar --- */}
      <Dialogo
        abierto={dialogo === 'eliminar'}
        onCerrar={cerrar}
        titulo="Eliminar el seguimiento"
        descripcion={`Se quita ${sp.sitioId} de este proyecto, con todas sus etapas y comentarios. El sitio sigue en el maestro y en sus otros proyectos. No se puede deshacer; la auditoría conserva el rastro.`}
        pie={
          <>
            <Boton disabled={eliminando} onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={eliminando || !validarEliminacion(sp, actor, { confirmacion, motivo }).ok}
              onClick={() => void eliminar()}
            >
              {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo etiqueta="Motivo" htmlFor="admin-motivo-eliminar" obligatorio>
            <AreaTexto
              id="admin-motivo-eliminar"
              value={motivo}
              disabled={eliminando}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: el sitio se cargó en el proyecto equivocado."
            />
          </Campo>
          <Campo
            etiqueta={`Escribe ${sp.sitioId} para confirmar`}
            htmlFor="admin-confirmar"
            obligatorio
          >
            <Entrada
              id="admin-confirmar"
              value={confirmacion}
              disabled={eliminando}
              autoComplete="off"
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </Campo>
        </div>
      </Dialogo>
    </>
  )
}
