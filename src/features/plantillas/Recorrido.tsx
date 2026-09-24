import { useState, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Clock,
  Flag,
  GripVertical,
  ListChecks,
  Play,
  Plus,
  TriangleAlert,
  UserCheck,
} from 'lucide-react'
import { Insignia, cn } from '@/components/ui'
import type { TipoEtapa } from '@/domain/gates/catalogo'
import { etapasDelCarril, pendientesDeEtapa } from '@/domain/plantillas/edicion'
import type { GatePlantilla } from '@/domain/tipos/gate'

interface PropsCarril {
  etapas: readonly GatePlantilla[]
  seleccion: string | null
  esNueva: (codigo: string) => boolean
  onSeleccionar: (codigo: string) => void
  onInsertar: (tipo: TipoEtapa, posicion: number) => void
  onMover: (tipo: TipoEtapa, desde: number, hasta: number) => void
}

/**
 * El recorrido que hace un sitio por la plantilla, dibujado como un camino:
 * entra, pasa por cada etapa en orden y sale cerrado. Debajo, lo que corre en
 * paralelo. Cada etapa es una tarjeta que se toca para editarla y se arrastra
 * para cambiarla de lugar; entre dos tarjetas hay un "+" para meter una etapa
 * justo ahi.
 */
export function Recorrido(props: PropsCarril) {
  const recorrido = etapasDelCarril(props.etapas, 'secuencial')
  const paralelas = etapasDelCarril(props.etapas, 'paralela')

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="titulo-recorrido" className="flex flex-col gap-2">
        <Encabezado
          id="titulo-recorrido"
          titulo="Recorrido del sitio"
          ayuda="El sitio pasa por estas etapas en orden. Toca una para editarla; arrástrala desde el borde derecho para cambiarla de lugar."
        />
        <div className="relative pl-10">
          {/* La linea del camino, de la entrada a la salida. */}
          <span
            aria-hidden
            className="absolute top-4 bottom-4 left-[19px] w-0.5 rounded bg-borde-fuerte"
          />
          <Hito icono={<Play aria-hidden className="size-3.5" />} texto="Entra el sitio" />
          <Carril tipo="secuencial" lista={recorrido} {...props} />
          <Hito
            icono={<Flag aria-hidden className="size-3.5" />}
            texto="Sitio cerrado"
            detalle="Terminó la última etapa del recorrido."
          />
        </div>
      </section>

      <section aria-labelledby="titulo-paralelo" className="flex flex-col gap-2">
        <Encabezado
          id="titulo-paralelo"
          titulo="En paralelo"
          ayuda="Trámites que corren al lado del recorrido, como el contrato o los permisos. Se siguen y se muestran, pero no frenan el avance del sitio."
        />
        <div className="relative pl-10">
          {paralelas.length > 0 && (
            <span
              aria-hidden
              className="absolute top-4 bottom-4 left-[19px] w-0.5 rounded border-l-2 border-dashed border-borde-fuerte"
            />
          )}
          <Carril tipo="paralela" lista={paralelas} {...props} />
        </div>
      </section>
    </div>
  )
}

function Encabezado({ id, titulo, ayuda }: { id: string; titulo: string; ayuda: string }) {
  return (
    <div>
      <h3 id={id} className="text-sm font-semibold">
        {titulo}
      </h3>
      <p className="text-xs text-texto-2">{ayuda}</p>
    </div>
  )
}

function Hito({ icono, texto, detalle }: { icono: ReactNode; texto: string; detalle?: string }) {
  return (
    <div className="relative flex min-h-9 items-center">
      <span className="absolute -left-10 flex w-10 justify-center">
        <span className="grid size-7 place-items-center rounded-full bg-superficie-inversa text-texto-inverso ring-4 ring-[var(--superficie)]">
          {icono}
        </span>
      </span>
      <span className="text-sm font-medium text-texto-2">
        {texto}
        {detalle && <span className="ml-2 text-xs font-normal text-texto-3">{detalle}</span>}
      </span>
    </div>
  )
}

const ANUNCIOS: Announcements = {
  onDragStart: ({ active }) => `Tomaste la etapa ${String(active.data.current?.nombre ?? '')}.`,
  onDragOver: ({ over }) =>
    over ? `Sobre la posición ${String(over.data.current?.posicion ?? '')}.` : 'Fuera de la lista.',
  onDragEnd: ({ over }) =>
    over ? `Quedó en la posición ${String(over.data.current?.posicion ?? '')}.` : 'No se movió.',
  onDragCancel: () => 'Se canceló. La etapa vuelve a su lugar.',
}

function Carril({
  tipo,
  lista,
  seleccion,
  esNueva,
  onSeleccionar,
  onInsertar,
  onMover,
}: PropsCarril & { tipo: TipoEtapa; lista: GatePlantilla[] }) {
  const [arrastrando, setArrastrando] = useState(false)
  const sensores = useSensors(
    // Un clic corto selecciona; recien pasados unos pixeles es un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const alSoltar = (e: DragEndEvent) => {
    setArrastrando(false)
    if (!e.over || e.active.id === e.over.id) return
    const desde = lista.findIndex((g) => g.codigo === e.active.id)
    const hasta = lista.findIndex((g) => g.codigo === e.over?.id)
    if (desde >= 0 && hasta >= 0) onMover(tipo, desde, hasta)
  }

  const paralelo = tipo === 'paralela'

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      // Dentro del dialogo hay dos cajas que se desplazan (el cuerpo y esta
      // columna). Con el desplazamiento automatico, al soltar la etapa quedaba
      // "sobre si misma" y no se movia. Las listas son cortas y hay botones
      // Antes/Despues, asi que no hace falta.
      autoScroll={false}
      accessibility={{
        announcements: ANUNCIOS,
        screenReaderInstructions: {
          draggable:
            'Para mover la etapa, presiona Espacio, usa las flechas arriba y abajo, y Espacio otra vez para dejarla. Escape cancela.',
        },
      }}
      onDragStart={() => setArrastrando(true)}
      onDragCancel={() => setArrastrando(false)}
      onDragEnd={alSoltar}
    >
      <SortableContext items={lista.map((g) => g.codigo)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col">
          {lista.map((g, i) => (
            <li key={g.codigo} className="flex flex-col">
              {!paralelo && (
                <PuntoInsercion
                  oculto={arrastrando}
                  etiqueta={i === 0 ? 'Agregar una etapa al inicio' : `Agregar una etapa aquí`}
                  onClick={() => onInsertar(tipo, i)}
                />
              )}
              <Tarjeta
                etapa={g}
                numero={paralelo ? null : i + 1}
                posicion={i + 1}
                seleccionada={g.codigo === seleccion}
                nueva={esNueva(g.codigo)}
                onSeleccionar={() => onSeleccionar(g.codigo)}
              />
              {paralelo && <span className="h-2" />}
            </li>
          ))}
        </ol>
      </SortableContext>
      <button
        type="button"
        onClick={() => onInsertar(tipo, lista.length)}
        className={cn(
          'my-2 flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-dashed border-borde-fuerte px-3 text-sm text-texto-2',
          'transition-colors hover:border-[var(--acento)] hover:bg-[var(--acento-suave)] hover:text-[var(--acento)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]',
        )}
      >
        <Plus aria-hidden className="size-4" />
        {paralelo
          ? 'Agregar un trámite en paralelo'
          : lista.length === 0
            ? 'Agregar la primera etapa'
            : 'Agregar una etapa al final'}
      </button>
    </DndContext>
  )
}

/** El "+" sobre la linea, entre dos etapas. */
function PuntoInsercion({
  etiqueta,
  oculto,
  onClick,
}: {
  etiqueta: string
  oculto: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'group relative -ml-10 flex h-7 items-center gap-2 rounded pl-10 text-left text-xs',
        'focus-visible:outline-2 focus-visible:outline-[var(--acento)]',
        oculto && 'invisible',
      )}
    >
      <span className="absolute left-0 flex w-10 justify-center">
        <span
          className={cn(
            'grid size-5 place-items-center rounded-full border border-borde-fuerte bg-superficie text-texto-3',
            'transition-colors group-hover:border-[var(--acento)] group-hover:bg-[var(--acento)] group-hover:text-[var(--acento-texto)]',
            'group-focus-visible:border-[var(--acento)] group-focus-visible:bg-[var(--acento)] group-focus-visible:text-[var(--acento-texto)]',
          )}
        >
          <Plus aria-hidden className="size-3" />
        </span>
      </span>
      <span className="text-[var(--acento)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Agregar aquí
      </span>
    </button>
  )
}

function Tarjeta({
  etapa,
  numero,
  posicion,
  seleccionada,
  nueva,
  onSeleccionar,
}: {
  etapa: GatePlantilla
  /** Solo las del recorrido llevan numero: las paralelas no tienen orden de paso. */
  numero: number | null
  posicion: number
  seleccionada: boolean
  nueva: boolean
  onSeleccionar: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: etapa.codigo, data: { nombre: etapa.nombre, posicion } })
  const pendientes = pendientesDeEtapa(etapa)
  const nombre = etapa.nombre.trim()
  const obligatorios = etapa.checklist.filter((i) => i.obligatorio).length

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10')}
    >
      <span aria-hidden className="absolute top-2.5 -left-10 flex w-10 justify-center">
        <span
          className={cn(
            `gate-${etapa.color}`,
            'grid place-items-center rounded-full text-xs font-semibold ring-4 ring-[var(--superficie)]',
            numero === null ? 'punto-gate mt-2 size-3.5' : 'insignia-gate size-7',
          )}
        >
          {numero}
        </span>
      </span>
      <div
        className={cn(
          `gate-${etapa.color}`,
          'flex items-stretch overflow-hidden rounded-lg border border-l-4 bg-superficie [border-left-color:var(--gate-punto)]',
          'transition-[border-color,box-shadow] duration-100',
          seleccionada
            ? 'border-[var(--acento)] shadow-[0_0_0_3px_var(--acento-anillo)]'
            : pendientes.length > 0
              ? 'border-[var(--riesgo-fg)]'
              : 'border-borde hover:border-borde-fuerte',
          isDragging && 'shadow-[var(--sombra-flotante)]',
        )}
      >
        <button
          type="button"
          aria-pressed={seleccionada}
          onClick={onSeleccionar}
          className="flex min-h-11 min-w-0 flex-1 flex-col gap-1 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--acento)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-sm font-medium', !nombre && 'text-texto-3 italic')}>
              {nombre || 'Sin nombre'}
            </span>
            {nueva && <Insignia tono="acento">Nueva</Insignia>}
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-texto-2">
            <Dato icono={<Clock aria-hidden className="size-3" />}>
              {etapa.slaDias} {etapa.slaDias === 1 ? 'día' : 'días'}
            </Dato>
            <Dato icono={<ListChecks aria-hidden className="size-3" />}>
              {etapa.checklist.length === 0
                ? 'Sin entregables'
                : `${etapa.checklist.length} ${etapa.checklist.length === 1 ? 'entregable' : 'entregables'}` +
                  (obligatorios > 0 && obligatorios < etapa.checklist.length
                    ? ` (${obligatorios} obligatorios)`
                    : '')}
            </Dato>
            {etapa.revisiones.length > 0 && (
              <Dato icono={<UserCheck aria-hidden className="size-3" />}>
                {etapa.revisiones.length === 1
                  ? '1 área revisa'
                  : `${etapa.revisiones.length} áreas revisan`}
              </Dato>
            )}
          </span>
          {pendientes.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--riesgo-fg)]">
              <TriangleAlert aria-hidden className="size-3.5" />
              {pendientes.join(' · ')}
            </span>
          )}
        </button>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover «${nombre || 'Sin nombre'}»`}
          title="Arrastra para cambiar el orden"
          className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center border-l border-borde text-texto-3 hover:bg-superficie-2 hover:text-texto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--acento)] active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}

function Dato({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icono}
      {children}
    </span>
  )
}
