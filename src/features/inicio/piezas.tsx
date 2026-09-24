import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/components/ui'
import {
  CERRADO,
  claseGate,
  nombreGate,
  type EtapaCatalogo as Etapa,
  type GateActual,
} from '@/domain/gates/catalogo'

/** Piezas del Inicio que tambien usa la ficha de proyecto: una sola forma de mostrar el plan. */

export const numero = (n: number) => n.toLocaleString('es-CL')

export interface Tramo {
  gate: GateActual
  total: number
  /** A donde lleva el clic: la lista de sitios en ese tramo. */
  a: string
}

/** Nombre del tramo: una etapa, o "Al aire" para los cerrados. */
export function nombreTramo(gate: GateActual, etapas: readonly Etapa[]): string {
  return gate === CERRADO ? 'Al aire' : nombreGate(gate, etapas)
}

/**
 * El proceso en una franja: cada tramo es una etapa, en su orden, con ancho
 * proporcional a los sitios que tiene. Debajo, la leyenda con los numeros.
 */
export function Franja({ tramos, etapas }: { tramos: readonly Tramo[]; etapas: readonly Etapa[] }) {
  return (
    <>
      <div className="franja flex h-11 gap-0.5 overflow-hidden rounded-full bg-[var(--gota)] p-1">
        {tramos.map((t) => (
          <Link
            key={t.gate}
            to={t.a}
            title={`${nombreTramo(t.gate, etapas)}: ${numero(t.total)}`}
            aria-label={`${nombreTramo(t.gate, etapas)}: ${numero(t.total)} sitios`}
            style={{
              flexGrow: t.total,
              ...(t.gate === CERRADO ? { background: 'var(--acento)' } : {}),
            }}
            className={cn(claseGate(t.gate, etapas), 'tramo-franja min-w-2 basis-0 rounded-full')}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {tramos.map((t) => (
          <li key={t.gate}>
            <Link
              to={t.a}
              className={cn(
                claseGate(t.gate, etapas),
                'enlace-sutil flex items-center gap-1.5 hover:[&>span]:text-[var(--acento)]',
              )}
            >
              <span
                aria-hidden
                className="punto-gate size-2 rounded-full"
                style={t.gate === CERRADO ? { background: 'var(--acento)' } : undefined}
              />
              <span className="text-texto-2">{nombreTramo(t.gate, etapas)}</span>
              <span className="font-medium text-texto tabular-nums">{numero(t.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Una cifra que abre la tabla con ese recorte. */
export function Cifra({
  etiqueta,
  valor,
  tono,
  a,
  cargando = false,
}: {
  etiqueta: string
  /** Un texto (—) cuando la cifra no aplica, p. ej. SLA en un proyecto sin SLA. */
  valor: number | string
  tono?: 'error' | 'riesgo' | 'ok' | undefined
  a: string
  cargando?: boolean
}) {
  const color = {
    error: 'text-[var(--error-fg)]',
    riesgo: 'text-[var(--riesgo-fg)]',
    ok: 'text-[var(--ok-fg)]',
  }
  const resaltar = typeof valor === 'number' && valor > 0 && tono
  return (
    <Link to={a} className="cifra-inicio group flex min-h-24 flex-col justify-between gap-3 p-4">
      <span className="flex items-center justify-between text-xs text-texto-2">
        {etiqueta}
        <ArrowRight
          aria-hidden
          className="size-3.5 -translate-x-1 opacity-0 transition-all duration-[var(--ms-rapido)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>
      {cargando ? (
        <span aria-hidden className="esqueleto h-7 w-12 rounded" />
      ) : (
        <span
          className={cn(
            'text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums',
            resaltar ? color[tono] : typeof valor === 'number' ? 'text-texto' : 'text-texto-3',
          )}
        >
          {typeof valor === 'number' ? numero(valor) : valor}
        </span>
      )}
    </Link>
  )
}
