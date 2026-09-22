import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Boton, Campo, Casilla, Dialogo, Entrada, Selector } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { guardarArea } from '@/data/repos/areas'
import { crearId } from '@/domain/tipos/identificadores'
import type { Area, Proyecto, Usuario } from '@/domain/tipos'
import type { Actor } from '@/domain/tipos/comunes'

/** Personas elegidas como chips, y un selector para agregar otra. */
function SelectorPersonas({
  elegidas,
  onCambiar,
  usuarios,
  etiqueta,
}: {
  elegidas: string[]
  onCambiar: (uids: string[]) => void
  usuarios: readonly Usuario[]
  etiqueta: string
}) {
  const nombre = (uid: string) => usuarios.find((u) => u.id === uid)?.nombre ?? uid
  const disponibles = usuarios.filter((u) => !elegidas.includes(u.id))
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {elegidas.map((uid) => (
        <span
          key={uid}
          className="flex items-center gap-1 rounded-full bg-superficie-3 py-0.5 pr-1 pl-2.5 text-xs"
        >
          {nombre(uid)}
          <button
            type="button"
            aria-label={`Quitar a ${nombre(uid)}`}
            onClick={() => onCambiar(elegidas.filter((u) => u !== uid))}
            className="rounded-full p-0.5 text-texto-3 hover:bg-superficie-2 hover:text-texto"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      {/* El ancho va en un contenedor: los controles traen w-full de base. */}
      <div className="w-48 max-w-full">
        <Selector
          aria-label={etiqueta}
          value=""
          className="h-7 text-xs"
          onChange={(e) => e.target.value && onCambiar([...elegidas, e.target.value])}
        >
          <option value="">{elegidas.length === 0 ? 'Elegir persona…' : 'Agregar…'}</option>
          {disponibles.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </Selector>
      </div>
    </div>
  )
}

/**
 * Alta o edicion de un area: su nombre, como aparece en los trackers, quienes
 * responden por defecto y, en los proyectos que lo necesiten, otras personas.
 */
export function EditorArea({
  area,
  areas,
  usuarios,
  proyectos,
  actor,
  onCerrar,
}: {
  area: Area | null
  areas: readonly Area[]
  usuarios: readonly Usuario[]
  proyectos: readonly Proyecto[]
  actor: Actor
  onCerrar: () => void
}) {
  // El contratista no responde revisiones de la PMO.
  const internos = usuarios.filter((u) => u.activo && u.rol !== 'contratista')
  const [nombre, setNombre] = useState(area?.nombre ?? '')
  const [alias, setAlias] = useState((area?.alias ?? []).join(', '))
  const [responsables, setResponsables] = useState<string[]>(area?.responsables ?? [])
  const [porProyecto, setPorProyecto] = useState<[string, string[]][]>(
    Object.entries(area?.porProyecto ?? {}),
  )
  const [activa, setActiva] = useState(area?.activa ?? true)
  const [guardando, setGuardando] = useState(false)

  const usados = new Set(porProyecto.map(([p]) => p))
  const libres = proyectos.filter((p) => !usados.has(p.id))

  const guardar = () => {
    const limpio = nombre.trim()
    if (!limpio) return
    const id =
      area?.id ??
      (() => {
        const base = crearId(limpio, 'area')
        return areas.some((a) => a.id === base) ? `${base}-${Date.now()}` : base
      })()
    const excepciones = Object.fromEntries(porProyecto.filter(([p, u]) => p && u.length > 0))
    setGuardando(true)
    guardarArea(
      id,
      {
        nombre: limpio,
        alias: alias
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        responsables,
        porProyecto: excepciones,
        activa,
      },
      actor,
      area,
    )
      .then(() => {
        avisar.ok(`Área «${limpio}» guardada`)
        onCerrar()
      })
      .catch((e) => avisar.error(`No se pudo guardar el área: ${mensajeDeError(e)}`))
      .finally(() => setGuardando(false))
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={area ? `Área ${area.nombre}` : 'Nueva área'}
      descripcion="Quienes responden por las revisiones de esta área. En un proyecto puntual pueden ser otras personas."
      ancho="lg"
      pie={
        <>
          <Boton onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando || !nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar área'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" htmlFor="area-nombre" obligatorio>
            <Entrada id="area-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo
            etiqueta="Cómo aparece en los trackers"
            htmlFor="area-alias"
            ayuda="Separados por coma. Así calza sola con las columnas «Status Ing RF»…"
          >
            <Entrada
              id="area-alias"
              value={alias}
              placeholder="RF, Radiofrecuencia"
              onChange={(e) => setAlias(e.target.value)}
            />
          </Campo>
        </div>

        <Campo etiqueta="Responden por defecto" htmlFor="area-resp">
          <SelectorPersonas
            elegidas={responsables}
            onCambiar={setResponsables}
            usuarios={internos}
            etiqueta="Agregar responsable por defecto"
          />
        </Campo>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Otras personas según el proyecto</p>
          {porProyecto.length === 0 && (
            <p className="text-xs text-texto-3">
              Ninguna excepción: en todos los proyectos responden los de arriba.
            </p>
          )}
          {porProyecto.map(([proyectoId, uids], i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded border border-borde p-2"
            >
              <div className="w-56 max-w-full">
                <Selector
                  aria-label="Proyecto"
                  value={proyectoId}
                  className="h-7 text-xs"
                  onChange={(e) =>
                    setPorProyecto(
                      porProyecto.map((f, k) => (k === i ? [e.target.value, f[1]] : f)),
                    )
                  }
                >
                  <option value="">Elegir proyecto…</option>
                  {proyectos
                    .filter((p) => p.id === proyectoId || !usados.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </Selector>
              </div>
              <div className="min-w-0 flex-1">
                <SelectorPersonas
                  elegidas={uids}
                  onCambiar={(nuevos) =>
                    setPorProyecto(porProyecto.map((f, k) => (k === i ? [f[0], nuevos] : f)))
                  }
                  usuarios={internos}
                  etiqueta="Agregar responsable en este proyecto"
                />
              </div>
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label="Quitar excepción"
                onClick={() => setPorProyecto(porProyecto.filter((_, k) => k !== i))}
                icono={<Trash2 aria-hidden className="size-3.5" />}
              />
            </div>
          ))}
          <div>
            <Boton
              tamano="sm"
              disabled={libres.length === 0}
              onClick={() => setPorProyecto([...porProyecto, ['', []]])}
              icono={<Plus aria-hidden className="size-3.5" />}
            >
              Agregar proyecto
            </Boton>
          </div>
        </div>

        <Casilla
          etiqueta="Activa"
          descripcion="Un área inactiva no genera pendientes."
          checked={activa}
          onChange={(e) => setActiva(e.target.checked)}
        />
      </div>
    </Dialogo>
  )
}
