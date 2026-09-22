import { Link } from 'react-router'

const numero = (n: number) => n.toLocaleString('es-CL')

export interface FilaTraba {
  id: string
  etiqueta: string
  total: number
  /** La parte del total que pide accion (observados, rechazados, atrasados). */
  destacado: number
  a: string
}

/**
 * Barras horizontales: cuanto espera en cada lugar y cuanto de eso ya pide
 * accion (en rojo Claro). Cada fila lleva su numero escrito y es un enlace a
 * la lista filtrada, asi el grafico nunca es un callejon sin salida.
 */
export function GraficoTrabas({
  titulo,
  subtitulo,
  filas,
  leyendaTotal,
  leyendaDestacado,
  vacio,
}: {
  titulo: string
  subtitulo: string
  filas: readonly FilaTraba[]
  leyendaTotal: string
  leyendaDestacado: string
  vacio: string
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.total))

  return (
    <figure className="flex flex-col gap-3">
      <figcaption>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="text-xs text-texto-3">{subtitulo}</span>
      </figcaption>

      {filas.length === 0 ? (
        <p className="grid h-40 place-items-center rounded-xl border border-dashed border-borde px-4 text-center text-sm text-texto-3">
          {vacio}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {filas.map((f) => (
              <li key={f.id}>
                <Link
                  to={f.a}
                  className="fila-inicio grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 rounded-md py-0.5"
                  aria-label={`${f.etiqueta}: ${numero(f.total)}, ${numero(f.destacado)} ${leyendaDestacado.toLowerCase()}`}
                >
                  <span className="truncate text-xs text-texto-2">{f.etiqueta}</span>
                  <span
                    aria-hidden
                    className="flex h-3 overflow-hidden rounded-r-[4px]"
                    style={{ width: `${(f.total / maximo) * 100}%` }}
                  >
                    {f.destacado > 0 && (
                      <span
                        className="h-full"
                        style={{
                          width: `${(f.destacado / f.total) * 100}%`,
                          background: 'var(--dato-destacado)',
                        }}
                      />
                    )}
                    {f.total > f.destacado && (
                      <span
                        className="h-full flex-1"
                        style={{
                          background: 'var(--dato)',
                          // Separador de 2px entre tramos, del color de la superficie.
                          marginLeft: f.destacado > 0 ? 2 : 0,
                        }}
                      />
                    )}
                  </span>
                  <span className="text-xs tabular-nums">
                    <span className="font-semibold">{numero(f.total)}</span>
                    {f.destacado > 0 && (
                      <span className="text-texto-3"> · {numero(f.destacado)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-texto-3">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--dato)]" />
              {leyendaTotal}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--dato-destacado)]" />
              {leyendaDestacado}
            </span>
          </p>
        </>
      )}
    </figure>
  )
}
