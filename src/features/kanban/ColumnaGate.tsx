import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/components/ui'
import {
  CERRADO,
  claseGate,
  gateAnterior,
  nombreGate,
  siguienteGate,
  type GateActual,
} from '@/domain/gates/catalogo'
import { estaAtrasado } from '@/domain/vistas/filtrado'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { TarjetaKanban } from './TarjetaKanban'
import { useCatalogos } from '@/hooks/useCatalogos'

const TANDA_TARJETAS = 24

export function ColumnaGate({
  gate,
  sitios,
  total,
  hoy,
  gateArrastrado,
  arrastrable,
  nombreProveedor,
}: {
  gate: GateActual
  sitios: SitioProyecto[]
  total: number
  hoy: string
  /** Gate de origen de la tarjeta en vuelo, si hay un arrastre en curso. */
  gateArrastrado: GateActual | null
  arrastrable: boolean
  nombreProveedor: (id: string | null) => string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: gate })
  // Cada tarjeta es arrastrable y dnd-kit la registra al montarla: pintar 60 por
  // columna eran ~500 al abrir el kanban. Se parte con las primeras y el resto
  // aparece a pedido.
  const [mostradas, setMostradas] = useState(TANDA_TARJETAS)

  const atrasados = sitios.filter((sp) => estaAtrasado(sp, hoy)).length

  const { etapas } = useCatalogos()
  const secuencia = etapas.map((e) => e.codigo)

  // Marca las columnas que aceptarian la tarjeta en vuelo (solo las adyacentes):
  // el usuario no tiene que adivinar cual es el movimiento valido.
  const esDestinoValido =
    gateArrastrado !== null &&
    gate !== gateArrastrado &&
    (gate === siguienteGate(gateArrastrado, secuencia) ||
      gate === gateAnterior(gateArrastrado, secuencia))
  const arrastreEnCurso = gateArrastrado !== null

  return (
    <section
      ref={setNodeRef}
      aria-label={`${nombreGate(gate, etapas)} — ${total} sitios`}
      className={cn(
        'flex w-72 shrink-0 snap-start flex-col rounded border bg-superficie-2 transition-colors',
        isOver && esDestinoValido
          ? 'border-[var(--acento)] bg-[var(--acento-suave)]'
          : 'border-borde',
        arrastreEnCurso &&
          esDestinoValido &&
          !isOver &&
          'border-dashed border-[var(--acento-borde)]',
        arrastreEnCurso && !esDestinoValido && gate !== gateArrastrado && 'opacity-55',
      )}
    >
      <header
        className={cn(
          claseGate(gate, etapas),
          'flex items-center gap-2 border-b border-borde px-2.5 py-2',
        )}
      >
        <span aria-hidden className="punto-gate size-2.5 rounded-full" />
        <h2 className="flex-1 truncate text-sm font-semibold">
          {gate === CERRADO ? 'Cerrado' : nombreGate(gate, etapas)}
        </h2>
        {atrasados > 0 && (
          <span
            title={`${atrasados} atrasados`}
            className="rounded bg-[var(--error-bg)] px-1.5 text-xs font-semibold text-[var(--error-fg)] tabular-nums"
          >
            {atrasados}
          </span>
        )}
        <span className="text-xs text-texto-3 tabular-nums">{total}</span>
      </header>

      <div className="panel-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {sitios.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-texto-3">
            {gate === CERRADO ? 'Ningun sitio cerrado' : 'Sin sitios en esta etapa'}
          </p>
        ) : (
          sitios
            .slice(0, mostradas)
            .map((sp) => (
              <TarjetaKanban
                key={sp.id}
                sp={sp}
                hoy={hoy}
                arrastrable={arrastrable && sp.gateActual !== CERRADO}
                nombreProveedor={nombreProveedor(sp.proveedorId)}
              />
            ))
        )}

        {sitios.length > mostradas && (
          <button
            type="button"
            onClick={() => setMostradas((n) => n + TANDA_TARJETAS)}
            className="enlace-sutil rounded-lg px-1 py-2 text-center text-xs"
          >
            Mostrar {Math.min(TANDA_TARJETAS, sitios.length - mostradas)} más
          </button>
        )}

        {total > sitios.length && sitios.length <= mostradas && (
          <p className="px-1 py-2 text-center text-xs text-texto-3">
            y {total - sitios.length} mas — usa los filtros para acotar
          </p>
        )}
      </div>

      {gate !== CERRADO && (
        <footer className="border-t border-borde px-2.5 py-1 text-[11px] text-texto-3">
          Siguiente: {nombreGate(siguienteGate(gate, secuencia) ?? CERRADO, etapas)}
        </footer>
      )}
    </section>
  )
}
