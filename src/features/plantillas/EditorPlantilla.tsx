import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CircleCheck, FilePlus2, Redo2, TriangleAlert, Undo2 } from 'lucide-react'
import { Aviso, Boton, Casilla, Dialogo, Entrada, cn } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { contarUsoPlantilla, guardarEdicionPlantilla } from '@/data/repos/catalogos'
import type { TipoEtapa } from '@/domain/gates/catalogo'
import { GATES_ESTANDAR } from '@/domain/gates/plantillaEstandar'
import { describirReferencias, type ConteoReferencias } from '@/domain/catalogos/referencias'
import {
  analizarCambios,
  cambiarCarril,
  codigoParaEtapa,
  codigosDefinitivos,
  etapaNueva,
  etapasDelCarril,
  evaluarImpacto,
  hayCambios,
  insertarEnCarril,
  moverEnCarril,
  renumerar,
  validarPlantilla,
} from '@/domain/plantillas/edicion'
import type { GatePlantilla, GateTemplate } from '@/domain/tipos/gate'
import type { Actor } from '@/domain/tipos/comunes'
import { DetalleEtapa } from './DetalleEtapa'
import { Recorrido } from './Recorrido'
import { RecorridoMini } from './RecorridoMini'
import { useHistorial } from './useHistorial'

type Uso =
  | { fase: 'cargando' }
  | { fase: 'listo'; conteo: ConteoReferencias }
  | { fase: 'error'; mensaje: string }

/**
 * Editor de una plantilla de etapas, pensado para quien no la ha editado nunca.
 *
 * A la izquierda, el recorrido del sitio dibujado como un camino (ver
 * Recorrido): se agregan etapas donde van, se arrastran para reordenarlas y se
 * tocan para editarlas. A la derecha, la etapa elegida en forma de preguntas.
 * Todo se puede deshacer, y cerrar con cambios pide confirmacion.
 *
 * `original` es la plantilla guardada (null en un alta o un duplicado) e
 * `inicial` el punto de partida del borrador. Que se puede cambiar sin romper
 * seguimientos lo decide domain/plantillas/edicion.ts; aca solo se muestra, y
 * el repositorio lo vuelve a comprobar antes de escribir.
 */
export function EditorPlantilla({
  original,
  inicial,
  actor,
  onCerrar,
  generarId,
  bases,
}: {
  original: GateTemplate | null
  inicial: GateTemplate
  actor: Actor
  onCerrar: () => void
  /** En un alta o un duplicado, el id sale del nombre. Sin esto se usa el de `inicial`. */
  generarId?: ((nombre: string) => string) | undefined
  /**
   * En una plantilla nueva desde cero, las existentes de las que se pueden
   * copiar las etapas. Sin esto no se ofrece elegir punto de partida.
   */
  bases?: readonly GateTemplate[] | undefined
}) {
  const historial = useHistorial<GateTemplate>(() => structuredClone(inicial))
  const borrador = historial.valor
  const [seleccion, setSeleccion] = useState<string | null>(
    () =>
      etapasDelCarril(inicial.gates, 'secuencial')[0]?.codigo ?? inicial.gates[0]?.codigo ?? null,
  )
  const [recienCreada, setRecienCreada] = useState<string | null>(null)
  const [eligiendoInicio, setEligiendoInicio] = useState(bases !== undefined)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  // Codigos que ya existen fuera de este borrador y no se recalculan al guardar:
  // los de la plantilla guardada, los de la copiada al duplicar y los de la
  // base elegida como punto de partida. Asi una copia sigue compartiendo
  // columnas con su original en el kanban y el embudo.
  const [heredados, setHeredados] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        (original ?? (bases === undefined ? inicial : null))?.gates.map((g) => g.codigo) ?? [],
      ),
  )
  const [uso, setUso] = useState<Uso>(
    original ? { fase: 'cargando' } : { fase: 'listo', conteo: {} },
  )
  const [guardando, setGuardando] = useState(false)
  const [rechazo, setRechazo] = useState<string[]>([])
  const idBase = useId()
  const refDetalle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!original) return
    let vigente = true
    contarUsoPlantilla(original.id)
      .then((conteo) => vigente && setUso({ fase: 'listo', conteo }))
      .catch(
        (e) =>
          vigente &&
          setUso({
            fase: 'error',
            mensaje: `No pudimos comprobar qué sitios usan esta plantilla (${mensajeDeError(e)}). Revisa tu conexión y vuelve a abrir el editor: sin esa comprobación no se puede guardar.`,
          }),
      )
    return () => {
      vigente = false
    }
  }, [original])

  // Ctrl+Z / Ctrl+Y fuera de los campos de texto: dentro, deshacen lo escrito.
  const { deshacer, rehacer } = historial
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null
      if (destino?.closest('input, textarea, select, [contenteditable]')) return
      if (!(e.ctrlKey || e.metaKey)) return
      const tecla = e.key.toLowerCase()
      if (tecla === 'z' && !e.shiftKey) {
        e.preventDefault()
        deshacer()
      } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
        e.preventDefault()
        rehacer()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [deshacer, rehacer])

  // Al editar, el id no cambia nunca: lo llevan los programas y los sitios.
  const id = original ? original.id : generarId ? generarId(borrador.nombre) : borrador.id

  const seguimientos = uso.fase === 'listo' ? (uso.conteo.sitioProyectos ?? 0) : 0
  const codigosOriginales = useMemo(
    () => new Set(original?.gates.map((g) => g.codigo) ?? []),
    [original],
  )
  const esNueva = (codigo: string) => !codigosOriginales.has(codigo)

  const cambios = original ? analizarCambios(original, borrador) : null
  const conCambios = original === null || (cambios !== null && hayCambios(cambios))
  const impacto =
    cambios && uso.fase === 'listo'
      ? evaluarImpacto(cambios, seguimientos)
      : { bloqueos: [], advertencias: [] }
  // Con el id que se va a guardar: en un alta el borrador lo trae vacio, y el
  // esquema lo rechazaria aunque el nombre ya este escrito.
  const errores = validarPlantilla({ ...borrador, id })

  const etapa = borrador.gates.find((g) => g.codigo === seleccion) ?? null
  const tipoEtapa: TipoEtapa = etapa?.tipo ?? 'secuencial'
  const carril = etapa ? etapasDelCarril(borrador.gates, tipoEtapa) : []
  const posicion = etapa ? carril.findIndex((g) => g.codigo === etapa.codigo) : -1
  const recorrido = etapasDelCarril(borrador.gates, 'secuencial')

  // ------------------------------------------------------------------ acciones

  const cambiarGates = (f: (gates: GatePlantilla[]) => GatePlantilla[], clave?: string) => {
    setRechazo([])
    setEligiendoInicio(false)
    historial.cambiar((b) => ({ ...b, gates: f(b.gates) }), clave)
  }

  const elegir = (codigo: string) => {
    setSeleccion(codigo)
    setRecienCreada(null)
    // En pantallas angostas el detalle queda debajo del recorrido: se lleva la vista.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() =>
        refDetalle.current?.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        }),
      )
    }
  }

  const insertar = (tipo: TipoEtapa, lugar: number) => {
    const nombre = tipo === 'paralela' ? 'Trámite nuevo' : 'Etapa nueva'
    const nueva: GatePlantilla = {
      ...etapaNueva(nombre, borrador.gates),
      codigo: codigoParaEtapa(nombre, [...borrador.gates.map((g) => g.codigo), ...heredados]),
      tipo,
    }
    cambiarGates((gates) => insertarEnCarril(gates, nueva, lugar))
    elegir(nueva.codigo)
    setRecienCreada(nueva.codigo)
  }

  const quitar = (codigo: string) => {
    const lista = etapasDelCarril(borrador.gates, tipoEtapa)
    const i = lista.findIndex((g) => g.codigo === codigo)
    const vecina = lista[i + 1] ?? lista[i - 1] ?? recorrido.find((g) => g.codigo !== codigo)
    cambiarGates((gates) => renumerar(gates.filter((g) => g.codigo !== codigo)))
    setSeleccion(vecina?.codigo ?? null)
  }

  const bloqueoQuitar = (g: GatePlantilla): string | null => {
    if (borrador.gates.length === 1) return 'Una plantilla necesita al menos una etapa.'
    if (g.tipo !== 'paralela' && recorrido.length === 1) {
      return 'Es la única etapa del recorrido: agrega otra antes de quitar esta.'
    }
    if (!codigosOriginales.has(g.codigo)) return null
    if (uso.fase !== 'listo') return 'Se podrá quitar cuando termine la comprobación de uso.'
    if (seguimientos > 0) {
      return `No se puede quitar: ${seguimientos} ${seguimientos === 1 ? 'sitio en seguimiento usa' : 'sitios en seguimiento usan'} esta plantilla y quedaría sin poder avanzar. Para cambiar la secuencia, duplica la plantilla y edita la copia.`
    }
    return null
  }

  const bloqueoCarril = (g: GatePlantilla): string | null =>
    g.tipo !== 'paralela' && recorrido.length === 1
      ? 'Es la única etapa del recorrido: agrega otra antes de pasarla a paralelo.'
      : null

  const partirDe = (gates: readonly GatePlantilla[] | null) => {
    setEligiendoInicio(false)
    if (!gates) return
    const copia = renumerar(structuredClone([...gates]))
    setHeredados((h) => new Set([...h, ...copia.map((g) => g.codigo)]))
    historial.cambiar((b) => ({ ...b, gates: copia }))
    setSeleccion(etapasDelCarril(copia, 'secuencial')[0]?.codigo ?? copia[0]?.codigo ?? null)
  }

  const puedeGuardar =
    conCambios &&
    errores.length === 0 &&
    impacto.bloqueos.length === 0 &&
    uso.fase === 'listo' &&
    !guardando

  const guardar = () => {
    setGuardando(true)
    // Las etapas nuevas toman aca el codigo de su nombre final.
    const gates = codigosDefinitivos(borrador.gates, heredados)
    guardarEdicionPlantilla(original, { ...borrador, id, gates }, actor)
      .then((r) => {
        if (r.guardado) {
          avisar.ok(
            original
              ? `Se guardó «${borrador.nombre.trim()}» como versión ${r.version}`
              : `Se creó «${borrador.nombre.trim()}»`,
          )
          onCerrar()
        } else {
          setRechazo(r.motivos)
        }
      })
      .catch((e) => setRechazo([`No se pudo guardar: ${mensajeDeError(e)}`]))
      .finally(() => setGuardando(false))
  }

  const pedirCierre = () => {
    if (conCambios && (original !== null || historial.puedeDeshacer)) setConfirmarSalida(true)
    else onCerrar()
  }

  const versionNueva = original ? original.version + 1 : 1

  return (
    <Dialogo
      abierto
      ancho="completo"
      onCerrar={pedirCierre}
      titulo={original ? `Editar «${original.nombre}»` : 'Nueva plantilla de etapas'}
      descripcion={
        original
          ? `Versión ${original.version}. Al guardar queda como versión ${versionNueva}.`
          : 'Define por qué etapas pasa un sitio, en qué orden y qué se entrega en cada una.'
      }
      pie={
        <>
          <span className="mr-auto flex flex-wrap items-center gap-1">
            <Boton
              variante="fantasma"
              tamano="sm"
              disabled={!historial.puedeDeshacer}
              onClick={historial.deshacer}
              title="Deshacer (Ctrl+Z)"
              icono={<Undo2 aria-hidden className="size-4" />}
            >
              Deshacer
            </Boton>
            <Boton
              variante="fantasma"
              tamano="sm"
              disabled={!historial.puedeRehacer}
              onClick={historial.rehacer}
              title="Rehacer (Ctrl+Y)"
              icono={<Redo2 aria-hidden className="size-4" />}
            >
              Rehacer
            </Boton>
            <EstadoGuardado
              conCambios={conCambios}
              bloqueos={impacto.bloqueos.length}
              errores={errores}
            />
          </span>
          <Boton onClick={pedirCierre}>Cancelar</Boton>
          <Boton
            variante="primario"
            disabled={!puedeGuardar}
            cargando={guardando}
            onClick={guardar}
          >
            {original ? 'Guardar cambios' : 'Crear plantilla'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <UsoPlantilla uso={uso} esNueva={original === null} />

        <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idBase}-nombre`} className="text-sm font-semibold">
              Nombre de la plantilla
            </label>
            <Entrada
              id={`${idBase}-nombre`}
              value={borrador.nombre}
              placeholder="Ej: Despliegue 5G"
              className="h-10! text-base"
              onChange={(e) => {
                const nombre = e.target.value
                setRechazo([])
                historial.cambiar((b) => ({ ...b, nombre }), 'plantilla:nombre')
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idBase}-desc`} className="text-sm font-semibold">
              ¿Para qué se usa? <span className="font-normal text-texto-3">(opcional)</span>
            </label>
            <Entrada
              id={`${idBase}-desc`}
              value={borrador.descripcion}
              placeholder="Ej: Sitios nuevos de la red 5G"
              className="h-10!"
              onChange={(e) => {
                const descripcion = e.target.value
                historial.cambiar((b) => ({ ...b, descripcion }), 'plantilla:desc')
              }}
            />
          </div>
        </div>

        <Casilla
          etiqueta="Disponible para programas nuevos"
          descripcion="Si la apagas, deja de ofrecerse al crear un programa y sus etapas pierden nombre y color en el embudo, el kanban y el mapa."
          checked={borrador.activo}
          onChange={(e) => {
            const activo = e.target.checked
            historial.cambiar((b) => ({ ...b, activo }))
          }}
        />

        {eligiendoInicio && bases && <PuntoDePartida bases={bases} onElegir={partirDe} />}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(20rem,25rem)_1fr]">
          <div className="panel-scroll lg:sticky lg:top-0 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto lg:pr-1">
            <Recorrido
              etapas={borrador.gates}
              seleccion={seleccion}
              esNueva={(codigo) => original !== null && esNueva(codigo)}
              onSeleccionar={elegir}
              onInsertar={insertar}
              onMover={(tipo, desde, hasta) =>
                cambiarGates((gates) => moverEnCarril(gates, tipo, desde, hasta))
              }
            />
          </div>

          <div ref={refDetalle} className="scroll-mt-2">
            {etapa ? (
              <DetalleEtapa
                key={etapa.codigo}
                etapa={etapa}
                posicion={posicion}
                total={carril.length}
                esNueva={!heredados.has(etapa.codigo)}
                enfocarNombre={recienCreada === etapa.codigo}
                bloqueoQuitar={bloqueoQuitar(etapa)}
                bloqueoCarril={bloqueoCarril(etapa)}
                onCambiar={(parche, clave) =>
                  cambiarGates(
                    (gates) =>
                      gates.map((g) => (g.codigo === etapa.codigo ? { ...g, ...parche } : g)),
                    clave,
                  )
                }
                onMover={(delta) =>
                  cambiarGates((gates) =>
                    moverEnCarril(gates, tipoEtapa, posicion, posicion + delta),
                  )
                }
                onCambiarCarril={(tipo) =>
                  cambiarGates((gates) => cambiarCarril(gates, etapa.codigo, tipo))
                }
                onQuitar={() => quitar(etapa.codigo)}
              />
            ) : (
              <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-borde-fuerte p-6 text-center text-sm text-texto-2">
                Toca una etapa del recorrido para editarla, o agrega una nueva con el botón «+».
              </div>
            )}
          </div>
        </div>

        {rechazo.length > 0 && (
          <Aviso tono="error" titulo="No se guardó">
            <Lista items={rechazo} />
          </Aviso>
        )}
        {impacto.bloqueos.length > 0 && (
          <Aviso tono="error" titulo="Hay cambios que romperían seguimientos en curso">
            <Lista items={impacto.bloqueos} />
          </Aviso>
        )}
        {errores.length > 0 && (
          <Aviso tono="riesgo" titulo="Falta completar antes de guardar">
            <Lista items={errores} />
          </Aviso>
        )}
        {impacto.advertencias.length > 0 && (
          <Aviso tono="info" titulo="Qué va a pasar al guardar">
            <Lista items={impacto.advertencias} />
          </Aviso>
        )}
      </div>

      {confirmarSalida && (
        <Dialogo
          abierto
          ancho="sm"
          onCerrar={() => setConfirmarSalida(false)}
          titulo="¿Salir sin guardar?"
          descripcion="Los cambios que hiciste en esta plantilla se van a perder."
          pie={
            <>
              <Boton onClick={() => setConfirmarSalida(false)}>Seguir editando</Boton>
              <Boton variante="peligro" onClick={onCerrar}>
                Salir sin guardar
              </Boton>
            </>
          }
        >
          <p className="text-sm text-texto-2">
            Si quieres conservarlos, vuelve y usa «
            {original ? 'Guardar cambios' : 'Crear plantilla'}».
          </p>
        </Dialogo>
      )}
    </Dialogo>
  )
}

function Lista({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc pl-4">
      {items.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  )
}

/** Una linea en el pie que dice si se puede guardar y, si no, por que. */
function EstadoGuardado({
  conCambios,
  bloqueos,
  errores,
}: {
  conCambios: boolean
  bloqueos: number
  errores: readonly string[]
}) {
  const [texto, tono] =
    bloqueos > 0
      ? ['Hay cambios que no se pueden guardar (ver abajo)', 'error']
      : errores.length > 0
        ? [
            errores.length === 1
              ? 'Falta completar 1 cosa (ver abajo)'
              : `Falta completar ${errores.length} cosas (ver abajo)`,
            'riesgo',
          ]
        : conCambios
          ? ['Listo para guardar', 'ok']
          : ['Sin cambios', 'neutro']
  return (
    <span
      role="status"
      className={cn(
        'ml-1 inline-flex items-center gap-1 text-xs',
        tono === 'error' && 'text-[var(--error-fg)]',
        tono === 'riesgo' && 'text-[var(--riesgo-fg)]',
        tono === 'ok' && 'text-[var(--ok-fg)]',
        tono === 'neutro' && 'text-texto-3',
      )}
    >
      {tono === 'ok' ? (
        <CircleCheck aria-hidden className="size-3.5" />
      ) : tono !== 'neutro' ? (
        <TriangleAlert aria-hidden className="size-3.5" />
      ) : null}
      {texto}
    </span>
  )
}

/**
 * Para una plantilla nueva: copiar las etapas de una que ya existe (y
 * ajustarlas) o empezar desde cero. Copiar es lo mas facil para quien recien
 * empieza: parte de algo que funciona.
 */
function PuntoDePartida({
  bases,
  onElegir,
}: {
  bases: readonly GateTemplate[]
  onElegir: (gates: readonly GatePlantilla[] | null) => void
}) {
  // Sin plantillas guardadas, se ofrece la estandar que trae la app.
  const opciones =
    bases.length > 0
      ? bases.map((b) => ({ id: b.id, nombre: b.nombre, gates: b.gates }))
      : [{ id: 'estandar', nombre: 'Despliegue estándar', gates: GATES_ESTANDAR }]

  return (
    <section
      aria-labelledby="titulo-partida"
      className="flex flex-col gap-3 rounded-xl border border-[var(--acento-borde)] bg-[var(--acento-suave)] p-4"
    >
      <div>
        <h3 id="titulo-partida" className="text-sm font-semibold">
          ¿Cómo quieres empezar?
        </h3>
        <p className="text-xs text-texto-2">
          Lo más fácil es copiar las etapas de una plantilla que ya existe y ajustarlas.
        </p>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {opciones.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onElegir(o.gates)}
              className="flex h-full w-full flex-col gap-2 rounded-lg border border-borde bg-superficie p-3 text-left transition-colors hover:border-[var(--acento)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]"
            >
              <span className="text-sm font-medium">Copiar las etapas de «{o.nombre}»</span>
              <RecorridoMini etapas={o.gates} nombre={o.nombre} />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onElegir(null)}
            className="flex h-full min-h-20 w-full items-center gap-3 rounded-lg border border-dashed border-borde-fuerte bg-superficie p-3 text-left transition-colors hover:border-[var(--acento)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]"
          >
            <FilePlus2 aria-hidden className="size-5 shrink-0 text-texto-3" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Empezar desde cero</span>
              <span className="text-xs text-texto-2">
                Con una sola etapa; agregas las que necesites.
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  )
}

function UsoPlantilla({ uso, esNueva }: { uso: Uso; esNueva: boolean }) {
  if (esNueva) return null
  if (uso.fase === 'cargando') {
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-texto-2">
        <span className="esqueleto inline-block h-3 w-40 rounded" />
        Comprobando qué la usa…
      </p>
    )
  }
  if (uso.fase === 'error') return <Aviso tono="error">{uso.mensaje}</Aviso>
  const texto = describirReferencias(uso.conteo)
  return (
    <p role="status" className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-texto-2">
      {texto
        ? `La usan ${texto}. Cambiar nombres y colores es seguro; los cambios de orden y etapas nuevas rigen para los sitios que entren desde ahora.`
        : 'Ningún programa ni sitio la usa todavía: puedes cambiar todo con libertad.'}
    </p>
  )
}
