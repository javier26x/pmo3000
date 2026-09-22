import { useId, useMemo, useState } from 'react'
import { Boton, Entrada, Insignia, cn } from '@/components/ui'
import {
  MAX_ENTRADAS_ALCANCE,
  entradasAlcance,
  totalEntradas,
  type NombresAlcance,
} from '@/domain/permisos/alcance'
import type { Alcance } from '@/domain/tipos/comunes'
import { useCatalogos } from '@/hooks/useCatalogos'

interface Opcion {
  id: string
  nombre: string
  detalle?: string
}

/** Nombres legibles para chips y resumenes, desde los catalogos en memoria. */
export function useNombresAlcance(): NombresAlcance {
  const { nombreCelula, nombrePrograma, nombreProyecto } = useCatalogos()
  return useMemo(
    () => ({ celula: nombreCelula, programa: nombrePrograma, proyecto: nombreProyecto }),
    [nombreCelula, nombrePrograma, nombreProyecto],
  )
}

/**
 * Chips del alcance de un usuario, para la fila de la tabla. Sin restriccion
 * dice "Todo"; con muchas entradas muestra las primeras y cuantas faltan.
 */
export function ChipsAlcance({ alcance, maximo = 3 }: { alcance: Alcance; maximo?: number }) {
  const nombres = useNombresAlcance()
  const entradas = entradasAlcance(alcance, nombres)
  if (entradas.length === 0) return <span className="text-texto-3">Todo</span>

  const visibles = entradas.slice(0, maximo)
  const resto = entradas.length - visibles.length
  return (
    <span className="flex flex-wrap gap-1" title={entradas.map((e) => e.etiqueta).join('\n')}>
      {visibles.map((e) => (
        <Insignia key={`${e.tipo}-${e.id}`} tono="info" className="max-w-40 truncate">
          {e.etiqueta}
        </Insignia>
      ))}
      {resto > 0 && <Insignia>+{resto}</Insignia>}
    </span>
  )
}

/**
 * Editor del alcance: tres listas de casillas (células, programas, proyectos)
 * con buscador. Basta con que un seguimiento calce en UNA de ellas para que el
 * usuario lo vea. El tope de 30 entradas no es de la app: es lo que Firestore
 * admite en una consulta or(); se muestra el conteo y se avisa al pasarlo.
 */
export function EditorAlcance({
  valor,
  onCambio,
}: {
  valor: Alcance
  onCambio: (alcance: Alcance) => void
}) {
  const { celulas, programas, proyectos, nombrePrograma } = useCatalogos()
  const total = totalEntradas(valor)
  const excedido = total > MAX_ENTRADAS_ALCANCE

  const alternar = (lista: keyof Alcance, id: string) => {
    const actual = valor[lista]
    onCambio({
      ...valor,
      [lista]: actual.includes(id) ? actual.filter((v) => v !== id) : [...actual, id],
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-texto-2">
          {total === 0 ? (
            <>
              Sin restricción: ve <strong className="font-medium text-texto">todo</strong> el
              despliegue.
            </>
          ) : (
            'Solo ve y edita los sitios cuya célula, programa o proyecto esté marcado.'
          )}
        </p>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            excedido ? 'font-medium text-[var(--error-fg)]' : 'text-texto-3',
          )}
        >
          {total}/{MAX_ENTRADAS_ALCANCE}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ListaAlcance
          titulo="Células"
          opciones={celulas.map((c) => ({ id: c.id, nombre: c.nombre }))}
          marcados={valor.celulas}
          onAlternar={(id) => alternar('celulas', id)}
        />
        <ListaAlcance
          titulo="Programas"
          opciones={programas.map((p) => ({ id: p.id, nombre: p.nombre }))}
          marcados={valor.programas}
          onAlternar={(id) => alternar('programas', id)}
        />
        <ListaAlcance
          titulo="Proyectos"
          opciones={proyectos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            detalle: nombrePrograma(p.programaId),
          }))}
          marcados={valor.proyectos}
          onAlternar={(id) => alternar('proyectos', id)}
        />
      </div>

      {total > 0 && (
        <div className="flex justify-end">
          <Boton
            tamano="sm"
            onClick={() => onCambio({ celulas: [], programas: [], proyectos: [] })}
          >
            Quitar restricción
          </Boton>
        </div>
      )}
    </div>
  )
}

function ListaAlcance({
  titulo,
  opciones,
  marcados,
  onAlternar,
}: {
  titulo: string
  opciones: Opcion[]
  marcados: string[]
  onAlternar: (id: string) => void
}) {
  const id = useId()
  const [busqueda, setBusqueda] = useState('')

  // Un id marcado que ya no existe en el catalogo (se borro la celula, por
  // ejemplo) igual se muestra, para que se pueda desmarcar.
  const todas = useMemo(() => {
    const conocidas = new Set(opciones.map((o) => o.id))
    const huerfanas = marcados
      .filter((m) => !conocidas.has(m))
      .map((m) => ({ id: m, nombre: m, detalle: 'No existe en el catálogo' }))
    return [...huerfanas, ...opciones]
  }, [opciones, marcados])

  const filtro = busqueda.trim().toLowerCase()
  const visibles = filtro
    ? todas.filter((o) => `${o.nombre} ${o.detalle ?? ''}`.toLowerCase().includes(filtro))
    : todas

  return (
    <fieldset className="flex min-w-0 flex-col gap-1 rounded border border-borde p-2">
      <legend className="px-1 text-xs font-medium text-texto-2">
        {titulo}
        {marcados.length > 0 && <span className="ml-1 text-texto-3">({marcados.length})</span>}
      </legend>
      <Entrada
        id={`${id}-buscar`}
        aria-label={`Buscar ${titulo.toLowerCase()}`}
        placeholder="Buscar…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <ul className="panel-scroll max-h-40 overflow-y-auto">
        {visibles.length === 0 && (
          <li className="px-1 py-1 text-xs text-texto-3">Sin resultados</li>
        )}
        {visibles.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-superficie-2">
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 shrink-0 accent-[var(--acento)]"
                checked={marcados.includes(o.id)}
                onChange={() => onAlternar(o.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-texto">{o.nombre}</span>
                {o.detalle && <span className="block truncate text-texto-3">{o.detalle}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
