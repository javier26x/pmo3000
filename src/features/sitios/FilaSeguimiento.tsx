import { Link } from 'react-router'
import { Lock } from 'lucide-react'
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

/** Fila de la tabla de seguimiento. Alto fijo: la virtualizacion lo necesita. */
export function FilaSeguimiento({ datos }: { datos: DatosFila }) {
  const { sp, hoy } = datos
  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
  const dias = atrasoDeSeguimiento(sp, hoy)
  const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)

  return (
    <tr
      className="border-b border-borde last:border-0 hover:bg-superficie-2"
      style={{ height: 'var(--alto-fila)' }}
    >
      <Celda className="font-mono text-xs">
        <Link
          to={`/seguimiento/${encodeURIComponent(sp.id)}`}
          className="rounded text-[var(--acento)] hover:underline"
        >
          {sp.sitioId}
        </Link>
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
        <Insignia tono={TONO_SEMAFORO[estado]}>
          {estado === 'sin_fecha' ? 's/f' : estado === 'por_vencer' ? 'por vencer' : estado}
        </Insignia>
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

/** Version en tarjeta para celular: la tabla no cabe y forzarla se vuelve ilegible. */
export function TarjetaSeguimiento({ datos }: { datos: DatosFila }) {
  const { sp, hoy } = datos
  const gate = sp.gateActual === 'CERRADO' ? null : sp.gates[sp.gateActual]
  const dias = atrasoDeSeguimiento(sp, hoy)
  const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)

  return (
    <Link
      to={`/seguimiento/${encodeURIComponent(sp.id)}`}
      className="flex flex-col gap-1 border-b border-borde px-3 py-2 last:border-0 active:bg-superficie-2"
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
