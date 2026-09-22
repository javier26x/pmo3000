/**
 * Esqueleto de la ficha de sitio.
 *
 * Dibuja la misma estructura que va a aparecer —cabecera, secuencia de gates,
 * entregables y panel lateral— para que al llegar los datos nada salte de sitio.
 * Un spinner centrado no da esa información y obliga a reencontrar la pantalla.
 */
export function EsqueletoFicha() {
  return (
    <div aria-busy="true" aria-label="Cargando la ficha del sitio">
      <div className="shrink-0 border-b border-borde bg-superficie px-3 py-2.5">
        <span className="esqueleto mb-2 block h-3 w-48 rounded" />
        <span className="esqueleto mb-2 block h-4 w-80 rounded" />
        <div className="flex gap-6">
          {[56, 40, 44, 36, 40].map((ancho, i) => (
            <span key={i} className="esqueleto block h-7 rounded" style={{ width: ancho * 2 }} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(260px,340px)]">
        <div className="rounded-lg border border-borde bg-superficie p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-start gap-2.5">
              <span className="esqueleto size-[22px] shrink-0 rounded-full" />
              <span className="flex-1">
                <span className="esqueleto mb-1.5 block h-3 w-24 rounded" />
                <span className="esqueleto block h-2.5 w-full rounded" />
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-borde bg-superficie p-3">
          <span className="esqueleto mb-3 block h-3 w-40 rounded" />
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <span className="esqueleto block h-12 rounded" />
            <span className="esqueleto block h-12 rounded" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <span className="esqueleto size-4 shrink-0 rounded" />
              <span className="esqueleto block h-3 flex-1 rounded" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-borde bg-superficie p-3">
            <span className="esqueleto mb-3 block h-3 w-24 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="esqueleto mb-2 block h-12 rounded" />
            ))}
          </div>
          <div className="rounded-lg border border-borde bg-superficie p-3">
            <span className="esqueleto mb-3 block h-3 w-32 rounded" />
            <span className="esqueleto block h-24 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
