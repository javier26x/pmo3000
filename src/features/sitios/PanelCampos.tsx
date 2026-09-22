import { formatearValor } from '@/domain/tracker/campos'
import type { CampoPlantilla } from '@/domain/tipos/gate'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { EstadoVacio } from '@/components/ui'

/**
 * Los campos propios del tracker, agrupados como venian en la planilla.
 *
 * Un tracker real trae mas de cien columnas por sitio. Mostrarlas en una lista
 * plana seria tan ilegible como la planilla; agrupadas por etapa, y ocultando
 * las que este sitio no tiene, quedan unas pocas decenas y se pueden leer.
 */
export function PanelCampos({
  sp,
  campos,
}: {
  sp: SitioProyecto
  campos: readonly CampoPlantilla[]
}) {
  const conDato = campos.filter((c) => {
    const v = sp.valores[c.id]
    return v !== undefined && v !== null && v !== ''
  })

  if (conDato.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin campos propios"
        descripcion="Este proyecto no tiene columnas adicionales, o este sitio no las trae con dato."
      />
    )
  }

  const grupos = new Map<string, CampoPlantilla[]>()
  for (const campo of conDato) {
    const lista = grupos.get(campo.grupo) ?? []
    lista.push(campo)
    grupos.set(campo.grupo, lista)
  }

  return (
    <div className="@container flex flex-col gap-4">
      {[...grupos.entries()].map(([grupo, lista]) => (
        <section key={grupo}>
          <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-texto-3 uppercase">
            {grupo}
          </h4>
          {/* La etiqueta va ARRIBA del valor, no al lado. Con nombres como
              "W TSS Aprobación Implementación" y un panel lateral angosto, una
              etiqueta en columna fija se come todo el ancho y el valor —que es
              lo que se viene a leer— queda cortado o invisible. */}
          <dl className="grid gap-x-6 gap-y-2 @md:grid-cols-2">
            {lista.map((campo) => (
              <div key={campo.id} className="min-w-0">
                <dt className="truncate text-xs text-texto-3" title={campo.nombre}>
                  {campo.nombre}
                </dt>
                <dd
                  className={
                    campo.tipo === 'texto_largo'
                      ? 'text-sm whitespace-pre-line'
                      : 'truncate text-sm'
                  }
                  title={formatearValor(campo.tipo, sp.valores[campo.id] ?? null)}
                >
                  {formatearValor(campo.tipo, sp.valores[campo.id] ?? null)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
