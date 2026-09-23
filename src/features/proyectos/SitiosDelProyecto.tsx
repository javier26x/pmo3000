import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LayoutGrid, Map as MapaIcono, Search } from 'lucide-react'
import { Casilla, EnlaceBoton, Entrada, InsigniaGate, cn } from '@/components/ui'
import { normalizarTexto } from '@/domain/tracker/estados'
import type { SitioProyecto } from '@/domain/tipos'

/** Cuantos se listan en la ficha; el resto se ve en Sitios, con todos los filtros. */
const MAXIMO = 40

/**
 * Los sitios del proyecto, dentro de su ficha.
 *
 * La ficha mostraba cuantos sitios hay por etapa pero no cuales: para verlos
 * habia que encontrar el boton de la cabecera. Aca se listan con un buscador y
 * cada uno abre su seguimiento. Para filtrar en serio (region, atrasados,
 * etapa) se sigue a Sitios, Kanban o Mapa ya filtrados por el proyecto.
 */
export function SitiosDelProyecto({
  proyectoId,
  seguimientos,
}: {
  proyectoId: string
  seguimientos: readonly SitioProyecto[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [conNoVigentes, setConNoVigentes] = useState(false)

  const delProyecto = useMemo(
    () =>
      seguimientos
        .filter((sp) => sp.proyectoId === proyectoId)
        .sort(
          (a, b) =>
            Number(b.vigente) - Number(a.vigente) ||
            a.sitioId.localeCompare(b.sitioId, 'es', { numeric: true }),
        ),
    [seguimientos, proyectoId],
  )
  const noVigentes = delProyecto.filter((sp) => !sp.vigente).length

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda)
    return delProyecto.filter(
      (sp) =>
        (conNoVigentes || sp.vigente) &&
        (q === '' ||
          normalizarTexto(`${sp.sitioId} ${sp.sitioNombre} ${sp.comuna} ${sp.region}`).includes(q)),
    )
  }, [delProyecto, busqueda, conNoVigentes])

  const filtro = `?proy=${encodeURIComponent(proyectoId)}`

  if (delProyecto.length === 0) {
    return (
      <p className="text-sm text-texto-3">
        Este proyecto todavía no tiene sitios. Se agregan importando su tracker o desde Importar
        sitios.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Buscar un sitio del proyecto</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-3"
          />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID, nombre o comuna"
            className="pl-8"
          />
        </label>
        {noVigentes > 0 && (
          <Casilla
            etiqueta={`Incluir no vigentes (${noVigentes})`}
            checked={conNoVigentes}
            onChange={(e) => setConNoVigentes(e.target.checked)}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <EnlaceBoton to={`/sitios${filtro}`} tamano="sm">
            Ver en Sitios
          </EnlaceBoton>
          <EnlaceBoton to={`/kanban${filtro}`} tamano="sm">
            <LayoutGrid aria-hidden className="size-3.5" />
            Kanban
          </EnlaceBoton>
          <EnlaceBoton to={`/mapa${filtro}`} tamano="sm">
            <MapaIcono aria-hidden className="size-3.5" />
            Mapa
          </EnlaceBoton>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="py-4 text-center text-sm text-texto-3">Ningún sitio calza con la búsqueda.</p>
      ) : (
        <ul className="divide-y divide-borde" aria-label="Sitios del proyecto">
          {visibles.slice(0, MAXIMO).map((sp) => (
            <li key={sp.id}>
              <Link
                to={`/seguimiento/${encodeURIComponent(sp.id)}`}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded px-1 py-1.5 hover:bg-superficie-2',
                  !sp.vigente && 'opacity-60',
                )}
              >
                <span className="w-20 shrink-0 truncate font-mono text-xs text-texto-3">
                  {sp.sitioId}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{sp.sitioNombre}</span>
                <span className="hidden w-32 shrink-0 truncate text-xs text-texto-3 sm:block">
                  {sp.comuna}
                </span>
                <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {visibles.length > MAXIMO && (
        <p className="text-xs text-texto-3">
          Se muestran {MAXIMO} de {visibles.length}.{' '}
          <Link to={`/sitios${filtro}`} className="enlace-sutil">
            Ver todos en Sitios
          </Link>
        </p>
      )}
    </div>
  )
}
