import { Link } from 'react-router'
import { Check, Copy, Lock } from 'lucide-react'
import { useState } from 'react'
import { Celda, Insignia, InsigniaGate, cn } from '@/components/ui'
import { formatearFecha } from '@/domain/fechas'
import { semaforo, textoAtraso } from '@/domain/gates/atraso'
import { NOMBRES_PRIORIDAD } from '@/domain/tipos/comunes'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { atrasoDeSeguimiento } from '@/domain/vistas/filtrado'

const TONO_SEMAFORO = {
  atrasado: 'error',
  por_vencer: 'riesgo',
  ok: 'ok',
  sin_fecha: 'neutro',
} as const

const TEXTO_SEMAFORO = {
  atrasado: 'atrasado',
  por_vencer: 'por vencer',
  ok: 'en plazo',
  sin_fecha: 's/f',
} as const

const TONO_PRIORIDAD = {
  critica: 'error',
  alta: 'riesgo',
  media: 'neutro',
  baja: 'neutro',
} as const

export interface DatosFila {
  sp: SitioProyecto
  nombrePrograma: string
  nombreProveedor: string
  nombreResponsable: string
  hoy: string
}

/** Copiar el ID del sitio: es lo que se pega en el correo o en la planilla. */
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      aria-label={`Copiar el ID ${texto}`}
      title="Copiar ID"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard
          ?.writeText(texto)
          .then(() => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1400)
          })
          .catch(() => setCopiado(false))
      }}
      className={cn(
        'rounded p-0.5 text-texto-3 transition-opacity duration-[var(--ms-instante)]',
        'hover:bg-superficie-3 hover:text-texto',
        copiado ? 'text-[var(--ok-fg)] opacity-100' : 'opacity-0 group-hover:opacity-100',
        'focus-visible:opacity-100',
      )}
    >
      {copiado ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />}
    </button>
  )
}

/** Fila de la tabla de seguimiento. Alto fijo: lo necesita la virtualización. */
export function FilaSeguimiento({
  datos,
  conCursor,
  onActivar,
  onApuntar,
}: {
  datos: DatosFila
  conCursor: boolean
  onActivar: () => void
  onApuntar: () => void
}) {
  const { sp, hoy } = datos
  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
  const dias = atrasoDeSeguimiento(sp, hoy)
  const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)

  return (
    <tr
      onMouseMove={onApuntar}
      onClick={onActivar}
      aria-selected={conCursor}
      className={cn(
        'group cursor-pointer border-b border-borde last:border-0',
        'transition-colors duration-[var(--ms-instante)]',
        conCursor ? 'fila-cursor' : 'hover:bg-superficie-2',
      )}
      style={{ height: 'var(--alto-fila)' }}
    >
      {/* El ID queda fijo al desplazar en horizontal: es la referencia de la fila. */}
      <Celda
        className={cn(
          'sticky left-0 z-[1] font-mono text-xs',
          conCursor ? 'bg-[var(--acento-suave)]' : 'bg-superficie group-hover:bg-superficie-2',
        )}
      >
        <span className="flex items-center gap-1">
          <Link
            to={`/seguimiento/${encodeURIComponent(sp.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded text-[var(--acento)] hover:underline"
          >
            {sp.sitioId}
          </Link>
          <BotonCopiar texto={sp.sitioId} />
        </span>
      </Celda>

      <Celda titulo={sp.sitioNombre} className="max-w-52">
        <span className="flex items-center gap-1">
          {sp.bloqueado && (
            <Lock
              aria-label="Sitio bloqueado"
              className="size-3 shrink-0 text-[var(--riesgo-fg)]"
            />
          )}
          {sp.sitioNombre}
        </span>
      </Celda>
      <Celda titulo={`${sp.comuna}, ${sp.region}`} className="max-w-36 text-texto-2">
        {sp.comuna}
      </Celda>
      <Celda titulo={datos.nombrePrograma} className="max-w-36 text-texto-2">
        {datos.nombrePrograma}
      </Celda>
      <Celda>
        <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
      </Celda>
      <Celda alineacion="derecha" className="text-texto-2 tabular-nums">
        {formatearFecha(gate?.fechaPlan ?? null)}
      </Celda>
      <Celda alineacion="derecha">
        <span
          className={cn(
            'tabular-nums',
            estado === 'atrasado' && 'font-semibold text-[var(--error-fg)]',
            estado === 'por_vencer' && 'text-[var(--riesgo-fg)]',
          )}
        >
          {textoAtraso(dias)}
        </span>
      </Celda>
      <Celda>
        <Insignia tono={TONO_SEMAFORO[estado]}>{TEXTO_SEMAFORO[estado]}</Insignia>
      </Celda>
      <Celda titulo={datos.nombreProveedor} className="max-w-32 text-texto-2">
        {datos.nombreProveedor}
      </Celda>
      <Celda titulo={datos.nombreResponsable} className="max-w-32 text-texto-2">
        {datos.nombreResponsable}
      </Celda>
      <Celda>
        <Insignia tono={TONO_PRIORIDAD[sp.prioridad]}>{NOMBRES_PRIORIDAD[sp.prioridad]}</Insignia>
      </Celda>
    </tr>
  )
}

/** Versión en tarjeta para celular: la tabla no cabe y forzarla la vuelve ilegible. */
export function TarjetaSeguimiento({ datos }: { datos: DatosFila }) {
  const { sp, hoy } = datos
  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
  const dias = atrasoDeSeguimiento(sp, hoy)
  const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)

  return (
    <Link
      to={`/seguimiento/${encodeURIComponent(sp.id)}`}
      className="flex flex-col gap-1 border-b border-borde px-3 py-2.5 last:border-0 active:bg-superficie-2"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--acento)]">{sp.sitioId}</span>
        <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
        {sp.bloqueado && (
          <Lock aria-label="Sitio bloqueado" className="size-3 text-[var(--riesgo-fg)]" />
        )}
        <span className="flex-1" />
        <Insignia tono={TONO_PRIORIDAD[sp.prioridad]}>{NOMBRES_PRIORIDAD[sp.prioridad]}</Insignia>
      </div>
      <p className="truncate text-sm font-medium">{sp.sitioNombre}</p>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-texto-2">
        <span>{sp.comuna}</span>
        <span>{datos.nombrePrograma}</span>
        <span>Plan {formatearFecha(gate?.fechaPlan ?? null)}</span>
        <span
          className={cn(
            estado === 'atrasado' && 'font-semibold text-[var(--error-fg)]',
            estado === 'por_vencer' && 'text-[var(--riesgo-fg)]',
          )}
        >
          {textoAtraso(dias)}
        </span>
      </div>
    </Link>
  )
}

/** Fila fantasma mientras llegan los datos: evita el salto al aparecer la tabla. */
export function FilaEsqueleto({ columnas }: { columnas: number }) {
  return (
    <tr className="border-b border-borde" style={{ height: 'var(--alto-fila)' }}>
      {Array.from({ length: columnas }).map((_, i) => (
        <Celda key={i}>
          <span
            className="esqueleto block h-3 rounded"
            style={{ width: `${[60, 80, 55, 70, 40, 65, 50, 45, 60, 55, 45][i] ?? 60}%` }}
          />
        </Celda>
      ))}
    </tr>
  )
}
