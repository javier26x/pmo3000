import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import {
  AreaTexto,
  Aviso,
  Boton,
  Campo,
  Casilla,
  Dialogo,
  Entrada,
  Insignia,
  cn,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { contarUsoPlantilla, guardarEdicionPlantilla } from '@/data/repos/catalogos'
import { COLORES_GATE, type ColorGate } from '@/domain/gates/catalogo'
import { describirReferencias, type ConteoReferencias } from '@/domain/catalogos/referencias'
import {
  analizarCambios,
  etapaNueva,
  evaluarImpacto,
  hayCambios,
  itemNuevo,
  moverEtapa,
  renumerar,
  revisionNueva,
  validarPlantilla,
} from '@/domain/plantillas/edicion'
import type { GatePlantilla, GateTemplate } from '@/domain/tipos/gate'
import type { Actor } from '@/domain/tipos/comunes'

const NOMBRE_COLOR: Record<ColorGate, string> = {
  pizarra: 'Pizarra',
  ambar: 'Ámbar',
  violeta: 'Violeta',
  azul: 'Azul',
  cian: 'Cian',
  lima: 'Lima',
  esmeralda: 'Esmeralda',
  rosa: 'Rosa',
  naranja: 'Naranja',
  rojo: 'Rojo',
  gris: 'Gris',
}

type Uso =
  | { fase: 'cargando' }
  | { fase: 'listo'; conteo: ConteoReferencias }
  | { fase: 'error'; mensaje: string }

/**
 * Editor de una plantilla de gates: nombre, etapas (orden, nombre, color, SLA),
 * checklist y revisiones de cada una.
 *
 * `original` es la plantilla guardada (null en un alta o un duplicado) y
 * `inicial` el punto de partida del borrador. Lo que se puede cambiar sin romper
 * seguimientos lo decide domain/plantillas/edicion.ts; aca solo se muestra, y el
 * repositorio lo vuelve a comprobar antes de escribir.
 */
export function EditorPlantilla({
  original,
  inicial,
  actor,
  onCerrar,
  generarId,
}: {
  original: GateTemplate | null
  inicial: GateTemplate
  actor: Actor
  onCerrar: () => void
  /** En un alta o un duplicado, el id sale del nombre. Sin esto se usa el de `inicial`. */
  generarId?: ((nombre: string) => string) | undefined
}) {
  const [borrador, setBorrador] = useState<GateTemplate>(() => structuredClone(inicial))
  const [seleccion, setSeleccion] = useState(0)
  const [nombreEtapa, setNombreEtapa] = useState('')
  const [uso, setUso] = useState<Uso>(
    original ? { fase: 'cargando' } : { fase: 'listo', conteo: {} },
  )
  const [guardando, setGuardando] = useState(false)
  const [rechazo, setRechazo] = useState<string[]>([])
  const idBase = useId()

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

  // Al editar, el id no cambia nunca: lo llevan los programas y los sitios.
  const id = original ? original.id : generarId ? generarId(borrador.nombre) : borrador.id

  const seguimientos = uso.fase === 'listo' ? (uso.conteo.sitioProyectos ?? 0) : 0
  const codigosOriginales = useMemo(
    () => new Set(original?.gates.map((g) => g.codigo) ?? []),
    [original],
  )

  const cambios = original ? analizarCambios(original, borrador) : null
  const conCambios = original === null || (cambios !== null && hayCambios(cambios))
  const impacto =
    cambios && uso.fase === 'listo'
      ? evaluarImpacto(cambios, seguimientos)
      : { bloqueos: [], advertencias: [] }
  const errores = validarPlantilla(borrador)

  const etapa = borrador.gates[seleccion] ?? borrador.gates[0]
  const indice = etapa ? borrador.gates.indexOf(etapa) : -1

  // Una etapa que ya estaba en la plantilla no se puede quitar si hay sitios en
  // seguimiento: dejarian de poder avanzar. Mientras se cuenta, tampoco.
  const quitarBloqueado = (g: GatePlantilla) =>
    codigosOriginales.has(g.codigo) && (uso.fase !== 'listo' || seguimientos > 0)

  const cambiar = (parche: Partial<GateTemplate>) => {
    setRechazo([])
    setBorrador((b) => ({ ...b, ...parche }))
  }

  const cambiarEtapa = (i: number, parche: Partial<GatePlantilla>) => {
    setRechazo([])
    setBorrador((b) => ({
      ...b,
      gates: b.gates.map((g, k) => (k === i ? { ...g, ...parche } : g)),
    }))
  }

  const mover = (i: number, delta: -1 | 1) => {
    cambiar({ gates: moverEtapa(borrador.gates, i, delta) })
    setSeleccion(i + delta)
  }

  const agregarEtapa = () => {
    const nombre = nombreEtapa.trim()
    if (!nombre) return
    const nueva = etapaNueva(nombre, borrador.gates)
    cambiar({ gates: renumerar([...borrador.gates, nueva]) })
    setSeleccion(borrador.gates.length)
    setNombreEtapa('')
  }

  const quitarEtapa = (i: number) => {
    cambiar({ gates: renumerar(borrador.gates.filter((_, k) => k !== i)) })
    setSeleccion(Math.max(0, i - 1))
  }

  const descartar = () => {
    setBorrador(structuredClone(inicial))
    setSeleccion(0)
    setRechazo([])
  }

  const puedeGuardar =
    conCambios &&
    errores.length === 0 &&
    impacto.bloqueos.length === 0 &&
    uso.fase === 'listo' &&
    !guardando

  const guardar = () => {
    setGuardando(true)
    guardarEdicionPlantilla(original, { ...borrador, id }, actor)
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

  const versionNueva = original ? original.version + 1 : 1

  return (
    <Dialogo
      abierto
      ancho="xl"
      onCerrar={onCerrar}
      titulo={original ? `Editar plantilla «${original.nombre}»` : 'Nueva plantilla de gates'}
      descripcion={
        original
          ? `Identificador ${original.id} · versión ${original.version}. Los cambios se guardan como versión ${versionNueva}.`
          : `Se guardará con el identificador ${id}`
      }
      pie={
        <>
          {original && conCambios && (
            <Boton
              variante="fantasma"
              className="mr-auto"
              onClick={descartar}
              icono={<RotateCcw aria-hidden className="size-4" />}
            >
              Descartar cambios
            </Boton>
          )}
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            disabled={!puedeGuardar}
            cargando={guardando}
            onClick={guardar}
          >
            {original ? `Guardar versión ${versionNueva}` : 'Crear plantilla'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <UsoPlantilla uso={uso} esNueva={original === null} />

        <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
          <Campo etiqueta="Nombre" htmlFor={`${idBase}-nombre`} obligatorio>
            <Entrada
              id={`${idBase}-nombre`}
              value={borrador.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Descripción" htmlFor={`${idBase}-desc`}>
            <Entrada
              id={`${idBase}-desc`}
              value={borrador.descripcion}
              onChange={(e) => cambiar({ descripcion: e.target.value })}
            />
          </Campo>
        </div>

        <Casilla
          etiqueta="Plantilla activa"
          descripcion="Solo las plantillas activas se ofrecen al crear un programa y dan nombre y color a las etapas en el embudo, el kanban y el mapa."
          checked={borrador.activo}
          onChange={(e) => cambiar({ activo: e.target.checked })}
        />

        <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
          {/* Secuencia de etapas */}
          <section aria-label="Etapas" className="flex flex-col rounded-lg border border-borde">
            <h3 className="border-b border-borde px-3 py-2 text-xs font-medium text-texto-2">
              Etapas, en orden
            </h3>
            <ol className="divide-y divide-borde">
              {borrador.gates.map((g, i) => (
                <li
                  key={g.codigo}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-1',
                    i === indice && 'bg-superficie-2',
                  )}
                >
                  <button
                    type="button"
                    aria-current={i === indice ? 'true' : undefined}
                    onClick={() => setSeleccion(i)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-[var(--acento)]"
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-xs text-texto-3">
                      {i + 1}
                    </span>
                    <span
                      aria-hidden
                      className={cn(`gate-${g.color}`, 'punto-gate size-2.5 shrink-0 rounded-full')}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {g.nombre.trim() || <em className="text-texto-3">Sin nombre</em>}
                    </span>
                    {!codigosOriginales.has(g.codigo) && original && (
                      <Insignia tono="acento">Nueva</Insignia>
                    )}
                  </button>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    disabled={i === 0}
                    aria-label={`Subir «${g.nombre}»`}
                    title="Subir"
                    onClick={() => mover(i, -1)}
                    icono={<ArrowUp aria-hidden className="size-3.5" />}
                  />
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    disabled={i === borrador.gates.length - 1}
                    aria-label={`Bajar «${g.nombre}»`}
                    title="Bajar"
                    onClick={() => mover(i, 1)}
                    icono={<ArrowDown aria-hidden className="size-3.5" />}
                  />
                </li>
              ))}
            </ol>
            <form
              className="mt-auto flex gap-1.5 border-t border-borde p-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                agregarEtapa()
              }}
            >
              <label htmlFor={`${idBase}-nueva`} className="sr-only">
                Nombre de la etapa nueva
              </label>
              <Entrada
                id={`${idBase}-nueva`}
                placeholder="Etapa nueva…"
                value={nombreEtapa}
                onChange={(e) => setNombreEtapa(e.target.value)}
              />
              <Boton
                type="submit"
                tamano="sm"
                className="h-8"
                disabled={!nombreEtapa.trim()}
                icono={<Plus aria-hidden className="size-4" />}
              >
                Agregar
              </Boton>
            </form>
          </section>

          {/* Detalle de la etapa elegida */}
          {etapa ? (
            <DetalleEtapa
              key={etapa.codigo}
              idBase={idBase}
              etapa={etapa}
              esNueva={!codigosOriginales.has(etapa.codigo)}
              quitarBloqueado={quitarBloqueado(etapa)}
              motivoBloqueo={
                uso.fase !== 'listo'
                  ? 'Se podrá quitar cuando termine la comprobación de uso.'
                  : `No se puede quitar: ${seguimientos} ${seguimientos === 1 ? 'sitio en seguimiento usa' : 'sitios en seguimiento usan'} esta plantilla y quedaría sin poder avanzar. Para cambiar la secuencia, duplica la plantilla y edita la copia.`
              }
              soloUna={borrador.gates.length === 1}
              onCambiar={(parche) => cambiarEtapa(indice, parche)}
              onQuitar={() => quitarEtapa(indice)}
            />
          ) : (
            <p className="p-6 text-center text-sm text-texto-3">
              Agrega la primera etapa de la secuencia.
            </p>
          )}
        </div>

        {rechazo.length > 0 && (
          <Aviso tono="error" titulo="No se guardó">
            <ul className="list-disc pl-4">
              {rechazo.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
        {impacto.bloqueos.length > 0 && (
          <Aviso tono="error" titulo="Hay cambios que romperían seguimientos en curso">
            <ul className="list-disc pl-4">
              {impacto.bloqueos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
        {errores.length > 0 && (
          <Aviso tono="riesgo" titulo="Falta completar antes de guardar">
            <ul className="list-disc pl-4">
              {errores.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
        {impacto.advertencias.length > 0 && (
          <Aviso tono="info" titulo="Antes de guardar, ten en cuenta">
            <ul className="list-disc pl-4">
              {impacto.advertencias.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </div>
    </Dialogo>
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
    <p role="status" className="text-xs text-texto-2">
      {texto
        ? `La usan ${texto}. Renombrar o recolorear etapas es seguro; los cambios de secuencia rigen para los sitios que entren desde ahora.`
        : 'Ningún programa ni sitio la usa todavía: puedes cambiar todo con libertad.'}
    </p>
  )
}

function DetalleEtapa({
  idBase,
  etapa,
  esNueva,
  quitarBloqueado,
  motivoBloqueo,
  soloUna,
  onCambiar,
  onQuitar,
}: {
  idBase: string
  etapa: GatePlantilla
  esNueva: boolean
  quitarBloqueado: boolean
  motivoBloqueo: string
  soloUna: boolean
  onCambiar: (parche: Partial<GatePlantilla>) => void
  onQuitar: () => void
}) {
  const [textoItem, setTextoItem] = useState('')
  const [nombreRevision, setNombreRevision] = useState('')
  const id = `${idBase}-${etapa.codigo}`

  const agregarItem = () => {
    const texto = textoItem.trim()
    if (!texto) return
    onCambiar({ checklist: [...etapa.checklist, itemNuevo(etapa, texto)] })
    setTextoItem('')
  }

  const agregarRevision = () => {
    const nombre = nombreRevision.trim()
    if (!nombre) return
    onCambiar({ revisiones: [...etapa.revisiones, revisionNueva(etapa, nombre)] })
    setNombreRevision('')
  }

  return (
    <section
      aria-label={`Etapa ${etapa.nombre}`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-borde p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_6rem]">
        <Campo etiqueta="Nombre de la etapa" htmlFor={`${id}-nombre`} obligatorio>
          <Entrada
            id={`${id}-nombre`}
            value={etapa.nombre}
            onChange={(e) => onCambiar({ nombre: e.target.value })}
          />
        </Campo>
        <Campo
          etiqueta="Código"
          htmlFor={`${id}-codigo`}
          ayuda={esNueva ? 'Se genera del nombre.' : 'No cambia.'}
        >
          <Entrada
            id={`${id}-codigo`}
            value={etapa.codigo}
            readOnly
            disabled
            className="font-mono"
          />
        </Campo>
        <Campo etiqueta="SLA (días)" htmlFor={`${id}-sla`}>
          <Entrada
            id={`${id}-sla`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={Number.isFinite(etapa.slaDias) ? etapa.slaDias : ''}
            onChange={(e) => onCambiar({ slaDias: Math.trunc(Number(e.target.value)) })}
          />
        </Campo>
      </div>

      <Campo etiqueta="Descripción" htmlFor={`${id}-desc`}>
        <AreaTexto
          id={`${id}-desc`}
          rows={2}
          value={etapa.descripcion}
          onChange={(e) => onCambiar({ descripcion: e.target.value })}
        />
      </Campo>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-texto-2">Color</legend>
        <div className="flex flex-wrap gap-1.5">
          {COLORES_GATE.map((color) => (
            <label
              key={color}
              title={NOMBRE_COLOR[color]}
              className={cn(
                `gate-${color}`,
                'insignia-gate relative flex h-7 cursor-pointer items-center rounded px-2 text-xs font-semibold',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-[var(--acento)]',
                etapa.color === color && 'ring-2 ring-[var(--acento)] ring-offset-1',
              )}
            >
              <input
                type="radio"
                name={`${id}-color`}
                value={color}
                checked={etapa.color === color}
                onChange={() => onCambiar({ color })}
                className="sr-only"
              />
              {NOMBRE_COLOR[color]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Checklist */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-texto-2">
          Checklist ({etapa.checklist.length})
        </legend>
        {etapa.checklist.length === 0 && (
          <p className="text-xs text-texto-3">
            Sin entregables: la etapa se puede cerrar sin checklist.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {etapa.checklist.map((item, k) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label htmlFor={`${id}-item-${k}`} className="sr-only">
                Entregable {k + 1}
              </label>
              <Entrada
                id={`${id}-item-${k}`}
                className="min-w-48 flex-1"
                value={item.texto}
                onChange={(e) =>
                  onCambiar({
                    checklist: etapa.checklist.map((x, j) =>
                      j === k ? { ...x, texto: e.target.value } : x,
                    ),
                  })
                }
              />
              <Casilla
                etiqueta="Obligatorio"
                checked={item.obligatorio}
                onChange={(e) =>
                  onCambiar({
                    checklist: etapa.checklist.map((x, j) =>
                      j === k ? { ...x, obligatorio: e.target.checked } : x,
                    ),
                  })
                }
              />
              <Casilla
                etiqueta="Pide evidencia"
                checked={item.requiereEvidencia}
                onChange={(e) =>
                  onCambiar({
                    checklist: etapa.checklist.map((x, j) =>
                      j === k ? { ...x, requiereEvidencia: e.target.checked } : x,
                    ),
                  })
                }
              />
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label={`Quitar el entregable «${item.texto}»`}
                title="Quitar"
                onClick={() => onCambiar({ checklist: etapa.checklist.filter((_, j) => j !== k) })}
                icono={<X aria-hidden className="size-3.5" />}
              />
            </li>
          ))}
        </ul>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            agregarItem()
          }}
        >
          <label htmlFor={`${id}-item-nuevo`} className="sr-only">
            Entregable nuevo
          </label>
          <Entrada
            id={`${id}-item-nuevo`}
            placeholder="Entregable nuevo…"
            value={textoItem}
            onChange={(e) => setTextoItem(e.target.value)}
          />
          <Boton
            type="submit"
            tamano="sm"
            className="h-8"
            disabled={!textoItem.trim()}
            icono={<Plus aria-hidden className="size-4" />}
          >
            Agregar
          </Boton>
        </form>
      </fieldset>

      {/* Revisiones */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-texto-2">
          Revisiones por disciplina ({etapa.revisiones.length})
        </legend>
        {etapa.revisiones.length === 0 && (
          <p className="text-xs text-texto-3">
            Opcional. Úsalas cuando varias áreas (RF, OOCC, ECE…) revisan la etapa por separado.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {etapa.revisiones.map((r, k) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label htmlFor={`${id}-rev-${k}`} className="sr-only">
                Revisión {k + 1}
              </label>
              <Entrada
                id={`${id}-rev-${k}`}
                className="min-w-48 flex-1"
                value={r.nombre}
                onChange={(e) =>
                  onCambiar({
                    revisiones: etapa.revisiones.map((x, j) =>
                      j === k ? { ...x, nombre: e.target.value } : x,
                    ),
                  })
                }
              />
              <Casilla
                etiqueta="Su rechazo frena la etapa"
                checked={r.bloquea}
                onChange={(e) =>
                  onCambiar({
                    revisiones: etapa.revisiones.map((x, j) =>
                      j === k ? { ...x, bloquea: e.target.checked } : x,
                    ),
                  })
                }
              />
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                aria-label={`Quitar la revisión «${r.nombre}»`}
                title="Quitar"
                onClick={() =>
                  onCambiar({ revisiones: etapa.revisiones.filter((_, j) => j !== k) })
                }
                icono={<X aria-hidden className="size-3.5" />}
              />
            </li>
          ))}
        </ul>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            agregarRevision()
          }}
        >
          <label htmlFor={`${id}-rev-nueva`} className="sr-only">
            Revisión nueva
          </label>
          <Entrada
            id={`${id}-rev-nueva`}
            placeholder="Disciplina que revisa…"
            value={nombreRevision}
            onChange={(e) => setNombreRevision(e.target.value)}
          />
          <Boton
            type="submit"
            tamano="sm"
            className="h-8"
            disabled={!nombreRevision.trim()}
            icono={<Plus aria-hidden className="size-4" />}
          >
            Agregar
          </Boton>
        </form>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-3">
        <Boton
          variante="peligro"
          tamano="sm"
          disabled={quitarBloqueado || soloUna}
          onClick={onQuitar}
          icono={<Trash2 aria-hidden className="size-3.5" />}
        >
          Quitar etapa
        </Boton>
        {(quitarBloqueado || soloUna) && (
          <p className="min-w-0 flex-1 text-xs text-texto-3">
            {soloUna ? 'Una plantilla necesita al menos una etapa.' : motivoBloqueo}
          </p>
        )}
      </div>
    </section>
  )
}
