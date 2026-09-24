import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileCheck2,
  Minus,
  Plus,
  ShieldAlert,
  Split,
  Trash2,
  Route,
  X,
} from 'lucide-react'
import { AreaTexto, Boton, Entrada, cn } from '@/components/ui'
import { COLORES_GATE, type ColorGate, type TipoEtapa } from '@/domain/gates/catalogo'
import { itemNuevo, revisionNueva } from '@/domain/plantillas/edicion'
import type { GatePlantilla } from '@/domain/tipos/gate'

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

/**
 * Lo que se puede decir de una etapa, escrito como preguntas: como se llama,
 * cuanto deberia durar, que hay que entregar, quien la revisa. Lo tecnico (el
 * codigo) queda plegado al final.
 *
 * `clave` en onCambiar agrupa en el historial los cambios seguidos de un mismo
 * campo: escribir un nombre entero se deshace de una vez.
 */
export function DetalleEtapa({
  etapa,
  posicion,
  total,
  esNueva,
  enfocarNombre,
  bloqueoQuitar,
  bloqueoCarril,
  onCambiar,
  onMover,
  onCambiarCarril,
  onQuitar,
}: {
  etapa: GatePlantilla
  /** Posicion dentro de su carril, desde 0. */
  posicion: number
  /** Cuantas etapas tiene su carril. */
  total: number
  esNueva: boolean
  /** Recien creada: el foco va al nombre, con el texto provisorio seleccionado. */
  enfocarNombre: boolean
  /** Por que no se puede quitar, o null si se puede. */
  bloqueoQuitar: string | null
  /** Por que no puede pasar al otro carril, o null si puede. */
  bloqueoCarril: string | null
  onCambiar: (parche: Partial<GatePlantilla>, clave?: string) => void
  onMover: (delta: -1 | 1) => void
  onCambiarCarril: (tipo: TipoEtapa) => void
  onQuitar: () => void
}) {
  const id = useId()
  const refNombre = useRef<HTMLInputElement>(null)
  const paralela = etapa.tipo === 'paralela'
  const clave = (campo: string) => `${etapa.codigo}:${campo}`

  useEffect(() => {
    if (!enfocarNombre) return
    refNombre.current?.focus()
    refNombre.current?.select()
  }, [enfocarNombre, etapa.codigo])

  return (
    <section
      aria-label={`Editar la etapa ${etapa.nombre}`}
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-borde bg-superficie p-4"
    >
      {/* Cabecera: donde esta y como moverla */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className={cn(`gate-${etapa.color}`, 'punto-gate size-3 shrink-0 rounded-full')}
        />
        <p className="min-w-0 flex-1 text-xs text-texto-2">
          {paralela
            ? `Trámite en paralelo ${posicion + 1} de ${total}`
            : `Etapa ${posicion + 1} de ${total} del recorrido`}
        </p>
        <Boton
          tamano="sm"
          variante="fantasma"
          disabled={posicion === 0}
          onClick={() => onMover(-1)}
          icono={<ArrowUp aria-hidden className="size-3.5" />}
        >
          Antes
        </Boton>
        <Boton
          tamano="sm"
          variante="fantasma"
          disabled={posicion >= total - 1}
          onClick={() => onMover(1)}
          icono={<ArrowDown aria-hidden className="size-3.5" />}
        >
          Después
        </Boton>
      </div>

      <Pregunta titulo="¿Cómo se llama?" htmlFor={`${id}-nombre`}>
        <Entrada
          ref={refNombre}
          id={`${id}-nombre`}
          value={etapa.nombre}
          placeholder="Ej: Ingeniería"
          className="h-10! text-base font-medium"
          onChange={(e) => onCambiar({ nombre: e.target.value }, clave('nombre'))}
        />
      </Pregunta>

      <Pregunta
        titulo="¿Qué pasa en esta etapa?"
        ayuda="Opcional. Una frase que ayude a quien no la conoce."
        htmlFor={`${id}-desc`}
      >
        <AreaTexto
          id={`${id}-desc`}
          rows={2}
          value={etapa.descripcion}
          placeholder="Ej: Visita técnica al terreno para confirmar que el sitio es viable."
          onChange={(e) => onCambiar({ descripcion: e.target.value }, clave('desc'))}
        />
      </Pregunta>

      <Pregunta
        titulo="¿Cuántos días debería tomar?"
        ayuda={
          paralela
            ? 'Como corre en paralelo, no mueve las fechas plan del recorrido.'
            : 'Con estos días se calcula la fecha plan de cada sitio.'
        }
        htmlFor={`${id}-dias`}
      >
        <Dias
          id={`${id}-dias`}
          valor={etapa.slaDias}
          onCambiar={(slaDias) => onCambiar({ slaDias }, clave('dias'))}
        />
      </Pregunta>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">¿Es un paso del recorrido?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <OpcionCarril
            nombre={`${id}-carril`}
            marcada={!paralela}
            deshabilitada={paralela && bloqueoCarril !== null}
            icono={<Route aria-hidden className="size-4" />}
            titulo="Sí, es un paso"
            texto="El sitio tiene que terminarla para pasar a la siguiente."
            onElegir={() => onCambiarCarril('secuencial')}
          />
          <OpcionCarril
            nombre={`${id}-carril`}
            marcada={paralela}
            deshabilitada={!paralela && bloqueoCarril !== null}
            icono={<Split aria-hidden className="size-4" />}
            titulo="No, va en paralelo"
            texto="Corre al lado (contrato, permisos…) y no frena el avance."
            onElegir={() => onCambiarCarril('paralela')}
          />
        </div>
        {bloqueoCarril && <p className="text-xs text-texto-3">{bloqueoCarril}</p>}
      </fieldset>

      <Entregables etapa={etapa} idBase={id} onCambiar={onCambiar} />

      <Revisiones etapa={etapa} idBase={id} onCambiar={onCambiar} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Color</legend>
        <p className="mb-2 text-xs text-texto-2">
          Con este color aparece en el embudo, el kanban y el mapa.
        </p>
        <div className="flex flex-wrap gap-2">
          {COLORES_GATE.map((color) => (
            <label
              key={color}
              title={NOMBRE_COLOR[color]}
              className={cn(
                `gate-${color}`,
                'punto-gate relative grid size-9 cursor-pointer place-items-center rounded-full',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--acento)]',
                etapa.color === color &&
                  'ring-2 ring-[var(--texto)] ring-offset-2 ring-offset-[var(--superficie)]',
              )}
            >
              <input
                type="radio"
                name={`${id}-color`}
                value={color}
                checked={etapa.color === color}
                onChange={() => onCambiar({ color })}
                className="sr-only"
                aria-label={NOMBRE_COLOR[color]}
              />
              {etapa.color === color && <Check aria-hidden className="size-4 text-white" />}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-borde pt-4">
        <details className="text-xs text-texto-2">
          <summary className="cursor-pointer select-none">Detalles técnicos</summary>
          <p className="mt-2">
            Código interno:{' '}
            <code className="rounded bg-superficie-2 px-1 py-0.5 font-mono">
              {esNueva ? 'se genera del nombre al guardar' : etapa.codigo}
            </code>
            {!esNueva && '. No cambia aunque renombres la etapa.'}
          </p>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            variante="peligro"
            tamano="sm"
            disabled={bloqueoQuitar !== null}
            onClick={onQuitar}
            icono={<Trash2 aria-hidden className="size-3.5" />}
          >
            Quitar esta etapa
          </Boton>
          {bloqueoQuitar && <p className="min-w-0 flex-1 text-xs text-texto-3">{bloqueoQuitar}</p>}
        </div>
      </div>
    </section>
  )
}

function Pregunta({
  titulo,
  ayuda,
  htmlFor,
  children,
}: {
  titulo: string
  ayuda?: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {titulo}
      </label>
      {children}
      {ayuda && <p className="text-xs text-texto-2">{ayuda}</p>}
    </div>
  )
}

/** Numero de dias con botones grandes de menos y mas: no hace falta teclear. */
function Dias({
  id,
  valor,
  onCambiar,
}: {
  id: string
  valor: number
  onCambiar: (dias: number) => void
}) {
  const dias = Number.isFinite(valor) ? valor : 0
  return (
    <div className="flex items-center gap-2">
      <Boton
        soloIcono
        aria-label="Un día menos"
        className="size-10!"
        disabled={dias <= 0}
        onClick={() => onCambiar(Math.max(0, dias - 1))}
        icono={<Minus aria-hidden className="size-4" />}
      />
      <Entrada
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        className="h-10! w-20! text-center text-base tabular-nums"
        value={Number.isFinite(valor) ? valor : ''}
        onChange={(e) => onCambiar(Math.trunc(Number(e.target.value)))}
      />
      <Boton
        soloIcono
        aria-label="Un día más"
        className="size-10!"
        onClick={() => onCambiar(dias + 1)}
        icono={<Plus aria-hidden className="size-4" />}
      />
      <span className="text-sm text-texto-2">{dias === 1 ? 'día' : 'días'}</span>
    </div>
  )
}

function OpcionCarril({
  nombre,
  marcada,
  deshabilitada,
  icono,
  titulo,
  texto,
  onElegir,
}: {
  nombre: string
  marcada: boolean
  deshabilitada: boolean
  icono: ReactNode
  titulo: string
  texto: string
  onElegir: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--acento)]',
        marcada
          ? 'border-[var(--acento)] bg-[var(--acento-suave)]'
          : 'border-borde hover:border-borde-fuerte',
        deshabilitada && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="radio"
        name={nombre}
        checked={marcada}
        disabled={deshabilitada}
        onChange={onElegir}
        className="sr-only"
      />
      <span className={cn('mt-0.5', marcada ? 'text-[var(--acento)]' : 'text-texto-3')}>
        {icono}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="text-xs text-texto-2">{texto}</span>
      </span>
    </label>
  )
}

/** Boton que se prende y se apaga, para las opciones de un entregable o una revision. */
function Interruptor({
  activo,
  onCambiar,
  icono,
  children,
  descripcion,
}: {
  activo: boolean
  onCambiar: (activo: boolean) => void
  icono: ReactNode
  children: ReactNode
  descripcion: string
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      title={descripcion}
      onClick={() => onCambiar(!activo)}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acento)]',
        activo
          ? 'border-[var(--acento-borde)] bg-[var(--acento-suave)] text-[var(--acento)]'
          : 'border-borde text-texto-3 hover:border-borde-fuerte hover:text-texto-2',
      )}
    >
      {activo ? <Check aria-hidden className="size-3.5" /> : icono}
      {children}
    </button>
  )
}

/** Campo de texto + Agregar; Enter tambien agrega. */
function AgregarTexto({
  id,
  etiqueta,
  placeholder,
  onAgregar,
}: {
  id: string
  etiqueta: string
  placeholder: string
  onAgregar: (texto: string) => void
}) {
  const [texto, setTexto] = useState('')
  const agregar = () => {
    const limpio = texto.trim()
    if (!limpio) return
    onAgregar(limpio)
    setTexto('')
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        agregar()
      }}
    >
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <Entrada
        id={id}
        placeholder={placeholder}
        value={texto}
        className="h-10!"
        onChange={(e) => setTexto(e.target.value)}
      />
      <Boton
        type="submit"
        className="h-10!"
        disabled={!texto.trim()}
        icono={<Plus aria-hidden className="size-4" />}
      >
        Agregar
      </Boton>
    </form>
  )
}

function Entregables({
  etapa,
  idBase,
  onCambiar,
}: {
  etapa: GatePlantilla
  idBase: string
  onCambiar: (parche: Partial<GatePlantilla>, clave?: string) => void
}) {
  const cambiarItem = (
    k: number,
    parche: Partial<GatePlantilla['checklist'][number]>,
    clave?: string,
  ) =>
    onCambiar(
      { checklist: etapa.checklist.map((x, j) => (j === k ? { ...x, ...parche } : x)) },
      clave,
    )

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">¿Qué hay que entregar para terminarla?</legend>
      <p className="text-xs text-texto-2">
        <strong className="font-medium">Obligatorio</strong>: sin él, la etapa no se puede cerrar.{' '}
        <strong className="font-medium">Con respaldo</strong>: hay que adjuntar un archivo o foto.
      </p>
      {etapa.checklist.length === 0 && (
        <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-texto-2">
          Todavía no hay entregables: la etapa se puede cerrar sin marcar nada.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {etapa.checklist.map((item, k) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-borde p-2 sm:flex-row sm:items-center"
          >
            <label htmlFor={`${idBase}-item-${k}`} className="sr-only">
              Entregable {k + 1}
            </label>
            <Entrada
              id={`${idBase}-item-${k}`}
              className="min-w-0 flex-1"
              value={item.texto}
              onChange={(e) => cambiarItem(k, { texto: e.target.value }, `${item.id}:texto`)}
            />
            <span className="flex items-center gap-1.5">
              <Interruptor
                activo={item.obligatorio}
                onCambiar={(obligatorio) => cambiarItem(k, { obligatorio })}
                icono={<ShieldAlert aria-hidden className="size-3.5" />}
                descripcion="Sin este entregable, la etapa no se puede cerrar"
              >
                Obligatorio
              </Interruptor>
              <Interruptor
                activo={item.requiereEvidencia}
                onCambiar={(requiereEvidencia) => cambiarItem(k, { requiereEvidencia })}
                icono={<FileCheck2 aria-hidden className="size-3.5" />}
                descripcion="Hay que adjuntar un archivo o una foto como respaldo"
              >
                Con respaldo
              </Interruptor>
              <Boton
                variante="fantasma"
                soloIcono
                className="size-8"
                aria-label={`Quitar el entregable «${item.texto}»`}
                title="Quitar"
                onClick={() => onCambiar({ checklist: etapa.checklist.filter((_, j) => j !== k) })}
                icono={<X aria-hidden className="size-4" />}
              />
            </span>
          </li>
        ))}
      </ul>
      <AgregarTexto
        id={`${idBase}-item-nuevo`}
        etiqueta="Entregable nuevo"
        placeholder="Ej: Informe firmado"
        onAgregar={(texto) =>
          onCambiar({ checklist: [...etapa.checklist, itemNuevo(etapa, texto)] })
        }
      />
    </fieldset>
  )
}

function Revisiones({
  etapa,
  idBase,
  onCambiar,
}: {
  etapa: GatePlantilla
  idBase: string
  onCambiar: (parche: Partial<GatePlantilla>, clave?: string) => void
}) {
  const cambiarRevision = (
    k: number,
    parche: Partial<GatePlantilla['revisiones'][number]>,
    clave?: string,
  ) =>
    onCambiar(
      { revisiones: etapa.revisiones.map((x, j) => (j === k ? { ...x, ...parche } : x)) },
      clave,
    )

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">¿Qué áreas la revisan?</legend>
      <p className="text-xs text-texto-2">
        Opcional. Agrega las áreas que revisan por separado (RF, OOCC, ECE…). Si un área que{' '}
        <strong className="font-medium">puede frenar</strong> rechaza, el sitio se detiene hasta que
        se corrija.
      </p>
      <ul className="flex flex-col gap-2">
        {etapa.revisiones.map((r, k) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-lg border border-borde p-2 sm:flex-row sm:items-center"
          >
            <label htmlFor={`${idBase}-rev-${k}`} className="sr-only">
              Área {k + 1}
            </label>
            <Entrada
              id={`${idBase}-rev-${k}`}
              className="min-w-0 flex-1"
              value={r.nombre}
              onChange={(e) => cambiarRevision(k, { nombre: e.target.value }, `${r.id}:nombre`)}
            />
            <span className="flex items-center gap-1.5">
              <Interruptor
                activo={r.bloquea}
                onCambiar={(bloquea) => cambiarRevision(k, { bloquea })}
                icono={<ShieldAlert aria-hidden className="size-3.5" />}
                descripcion="Si esta área rechaza, el sitio no avanza"
              >
                Puede frenar
              </Interruptor>
              <Boton
                variante="fantasma"
                soloIcono
                className="size-8"
                aria-label={`Quitar el área «${r.nombre}»`}
                title="Quitar"
                onClick={() =>
                  onCambiar({ revisiones: etapa.revisiones.filter((_, j) => j !== k) })
                }
                icono={<X aria-hidden className="size-4" />}
              />
            </span>
          </li>
        ))}
      </ul>
      <AgregarTexto
        id={`${idBase}-rev-nueva`}
        etiqueta="Área que revisa"
        placeholder="Ej: RF"
        onAgregar={(nombre) =>
          onCambiar({ revisiones: [...etapa.revisiones, revisionNueva(etapa, nombre)] })
        }
      />
    </fieldset>
  )
}
