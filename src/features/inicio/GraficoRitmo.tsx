import { useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/components/ui'
import type { SemanaRitmo } from '@/domain/vistas/ritmo'

const diaMes = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const etiquetaSemana = (inicio: string) => diaMes.format(new Date(`${inicio}T00:00:00Z`))
const numero = (n: number) => n.toLocaleString('es-CL')

/**
 * Tope "redondo" del eje, justo por sobre el maximo. Con pasos finos (1,5,
 * 2, 2,5, 3, 4...) para que las barras usen la altura: con solo 1-2-5, un
 * maximo de 260 dejaba el eje en 500 y el grafico a media altura.
 */
function topeRedondo(maximo: number): number {
  if (maximo <= 4) return 4
  const potencia = 10 ** Math.floor(Math.log10(maximo))
  for (const paso of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (paso * potencia >= maximo) return paso * potencia
  }
  return 10 * potencia
}

const suma = (xs: readonly SemanaRitmo[]) => xs.reduce((s, x) => s + x.cerradas, 0)

/**
 * Etapas cerradas por semana, las ultimas doce. La semana en curso va en rojo
 * Claro (es la que el equipo todavia puede mover); las demas, en el color del
 * dato. Pasar el mouse o el foco por una barra muestra su detalle.
 */
export function GraficoRitmo({ semanas }: { semanas: readonly SemanaRitmo[] }) {
  const [activa, setActiva] = useState<number | null>(null)
  const tope = topeRedondo(Math.max(0, ...semanas.map((s) => s.cerradas)))
  const ultima = semanas.length - 1

  // Tendencia: las cuatro semanas completas mas recientes contra las cuatro
  // anteriores. La semana en curso no entra: esta a medias.
  const recientes = suma(semanas.slice(ultima - 4, ultima))
  const previas = suma(semanas.slice(ultima - 8, ultima - 4))
  const variacion = previas === 0 ? null : Math.round(((recientes - previas) / previas) * 100)
  const sinDatos = semanas.every((s) => s.cerradas === 0)
  const detalle = activa === null ? null : semanas[activa]

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span>
          <span className="block text-sm font-semibold">Ritmo semanal</span>
          <span className="text-xs text-texto-3">
            Etapas cerradas por semana · la semana en curso en rojo
          </span>
        </span>
        {variacion !== null && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              variacion >= 0 ? 'text-[var(--ok-fg)]' : 'text-[var(--riesgo-fg)]',
            )}
          >
            {variacion >= 0 ? (
              <TrendingUp aria-hidden className="size-3.5" />
            ) : (
              <TrendingDown aria-hidden className="size-3.5" />
            )}
            {variacion >= 0 ? '+' : ''}
            {variacion}% contra las 4 semanas anteriores
          </span>
        )}
      </figcaption>

      {sinDatos ? (
        <p className="grid h-40 place-items-center rounded-xl border border-dashed border-borde text-sm text-texto-3">
          Sin cierres en las últimas 12 semanas.
        </p>
      ) : (
        <div className="relative" onMouseLeave={() => setActiva(null)}>
          {/* Rejilla recesiva: cero, mitad y tope. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40">
            {[1, 0.5, 0].map((f) => (
              <div
                key={f}
                className="absolute inset-x-0 flex items-center gap-2"
                style={{ top: `${(1 - f) * 100}%` }}
              >
                <span className="w-7 -translate-y-1/2 text-right text-[10px] text-texto-3 tabular-nums">
                  {numero(Math.round(tope * f))}
                </span>
                <span className="h-px flex-1 -translate-y-1/2 bg-[var(--dato-rejilla)]" />
              </div>
            ))}
          </div>

          <div className="relative ml-9 flex h-40 items-end gap-1.5 sm:gap-2">
            {semanas.map((s, i) => {
              const alto = tope === 0 ? 0 : (s.cerradas / tope) * 100
              const esActual = i === ultima
              return (
                <button
                  key={s.inicio}
                  type="button"
                  onMouseEnter={() => setActiva(i)}
                  onFocus={() => setActiva(i)}
                  onBlur={() => setActiva(null)}
                  aria-label={`Semana del ${etiquetaSemana(s.inicio)}: ${numero(s.cerradas)} etapas cerradas, ${numero(s.alAire)} sitios al aire`}
                  className="group relative flex h-full flex-1 items-end rounded-sm focus-visible:outline-offset-2"
                >
                  <span
                    className={cn(
                      'block w-full rounded-t-[4px] transition-[height,opacity] duration-[var(--ms-normal)]',
                      activa !== null && activa !== i && 'opacity-45',
                    )}
                    style={{
                      height: `${Math.max(alto, s.cerradas > 0 ? 2 : 0)}%`,
                      background: esActual ? 'var(--dato-destacado)' : 'var(--dato)',
                    }}
                  />
                  {/* Etiqueta directa solo en la semana actual: el resto va en el hover. */}
                  {esActual && s.cerradas > 0 && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold tabular-nums"
                      style={{ bottom: `calc(${alto}% + 4px)` }}
                    >
                      {numero(s.cerradas)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div aria-hidden className="ml-9 mt-1.5 flex gap-1.5 text-[10px] text-texto-3 sm:gap-2">
            {semanas.map((s, i) => (
              <span key={s.inicio} className="flex-1 truncate text-center">
                {i === ultima ? 'Esta' : i % 3 === ultima % 3 ? etiquetaSemana(s.inicio) : ''}
              </span>
            ))}
          </div>

          {detalle && (
            <div
              role="status"
              className="vidrio-denso vidrio-alzado pointer-events-none absolute top-0 right-0 rounded-lg border px-3 py-2 text-xs"
            >
              <p className="font-medium">Semana del {etiquetaSemana(detalle.inicio)}</p>
              <p className="text-texto-2">
                <span className="font-semibold text-texto tabular-nums">
                  {numero(detalle.cerradas)}
                </span>{' '}
                etapas cerradas
              </p>
              <p className="text-texto-2">
                <span className="font-semibold text-texto tabular-nums">
                  {numero(detalle.alAire)}
                </span>{' '}
                sitios al aire
              </p>
            </div>
          )}
        </div>
      )}

      {/* La misma informacion como tabla, para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Etapas cerradas y sitios al aire por semana</caption>
        <thead>
          <tr>
            <th>Semana</th>
            <th>Etapas cerradas</th>
            <th>Sitios al aire</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => (
            <tr key={s.inicio}>
              <td>{etiquetaSemana(s.inicio)}</td>
              <td>{s.cerradas}</td>
              <td>{s.alAire}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
