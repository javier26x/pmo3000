import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { NOMBRES_TIPO } from '@/domain/tracker/campos'
import type { PlantillaInferida } from '@/domain/tracker/inferencia'
import type { IndiceColumnas } from '@/domain/tracker/aplicacion'
import { Aviso, Insignia, cn } from '@/components/ui'

const TONO_ROL: Record<string, string> = {
  estado: 'text-[var(--acento)]',
  comentario: 'text-texto-3',
  fecha: 'text-texto-2',
  semana: 'text-texto-2',
  atributo: 'text-texto-2',
  identidad: 'text-[var(--ok-fg)]',
}

/**
 * Lo que la app entendio del archivo, para que alguien lo confirme antes de que
 * se escriba nada. Es la parte que evita que una inferencia equivocada se
 * convierta en 1.400 documentos equivocados.
 */
export function RevisionPlantillaInferida({
  propuesta,
  indice,
}: {
  propuesta: PlantillaInferida
  indice: IndiceColumnas
}) {
  const [abierta, setAbierta] = useState<string | null>(propuesta.etapas[0]?.nombre ?? null)

  const identidadFaltante = (['id', 'nombre'] as const).filter(
    (k) => propuesta.identidad[k] === undefined,
  )

  return (
    <div className="flex flex-col gap-3">
      {propuesta.avisos.map((aviso) => (
        <Aviso key={aviso} tono="riesgo" titulo="Revisa esto antes de importar">
          {aviso}
        </Aviso>
      ))}

      <section className="rounded-lg border border-borde bg-superficie p-3">
        <h3 className="mb-1 text-md">El proceso que se detectó</h3>
        <p className="mb-3 text-xs text-texto-2">
          Las etapas salen de las columnas <code className="font-mono">Status</code> y su orden es
          el orden de las columnas en la planilla, que es el orden real del proceso. Dentro de cada
          etapa, cada disciplina que revisa queda con su propio estado, comentario y fecha.
        </p>

        <ol className="flex flex-col gap-1">
          {propuesta.etapas.map((etapa, i) => {
            const columnas = propuesta.columnas.filter((c) => c.etapa === etapa.nombre)
            const esta = abierta === etapa.nombre
            return (
              <li key={etapa.nombre} className="rounded border border-borde">
                <button
                  type="button"
                  onClick={() => setAbierta(esta ? null : etapa.nombre)}
                  aria-expanded={esta}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-superficie-2"
                >
                  {esta ? (
                    <ChevronDown aria-hidden className="size-3.5 shrink-0 text-texto-3" />
                  ) : (
                    <ChevronRight aria-hidden className="size-3.5 shrink-0 text-texto-3" />
                  )}
                  <span className="font-mono text-xs text-texto-3">{i + 1}</span>
                  <span className="text-sm font-medium">{etapa.nombre}</span>
                  {etapa.revisiones.length > 0 && (
                    <span className="text-xs text-texto-2">
                      revisan {etapa.revisiones.map((r) => r.nombre).join(', ')}
                    </span>
                  )}
                  <Insignia tono="neutro" className="ml-auto">
                    {columnas.length} col.
                  </Insignia>
                </button>

                {esta && (
                  <ul className="border-t border-borde px-2 py-1.5">
                    {columnas.map((c) => (
                      <li
                        key={c.campo.id}
                        className="flex items-baseline gap-2 py-0.5 text-xs whitespace-nowrap"
                      >
                        <span className={cn('w-20 shrink-0 font-medium', TONO_ROL[c.rol])}>
                          {c.rol}
                        </span>
                        <span className="w-24 shrink-0 text-texto-3">
                          {NOMBRES_TIPO[c.campo.tipo]}
                        </span>
                        <span className="min-w-0 truncate">{c.encabezado}</span>
                        {c.revision !== null && <Insignia tono="neutro">{c.revision}</Insignia>}
                        <span className="ml-auto shrink-0 text-texto-3">
                          {Math.round(c.llenado * 100)}% con dato
                        </span>
                        {c.noConvertibles > 0 && (
                          <span
                            title={`${c.noConvertibles} celdas no calzan con el tipo`}
                            className="flex shrink-0 items-center gap-0.5 text-[var(--riesgo-fg)]"
                          >
                            <AlertTriangle aria-hidden className="size-3" />
                            {c.noConvertibles}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="rounded-lg border border-borde bg-superficie p-3">
        <h3 className="mb-1 text-md">Las columnas del sitio</h3>
        <p className="mb-2 text-xs text-texto-2">
          {indice.campos.length} columnas se guardan como atributos de cada sitio dentro del
          proyecto. Los comentarios y las fechas de revisión no están acá: viajan dentro de su
          revisión.
        </p>
        {identidadFaltante.length > 0 ? (
          <Aviso tono="error" titulo="Falta una columna obligatoria">
            No se encontró la columna de {identidadFaltante.join(' ni de ')}. Sin ella no se puede
            importar: el ID del sitio es la llave del maestro.
          </Aviso>
        ) : (
          <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
            {(Object.entries(propuesta.identidad) as [string, number][]).map(([clave, i]) => (
              <div key={clave} className="flex items-baseline gap-2">
                <dt className="w-20 shrink-0 text-texto-3">{clave}</dt>
                <dd className="min-w-0 truncate">
                  {propuesta.columnas.find((c) => c.indice === i)?.encabezado ?? `columna ${i}`}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  )
}
