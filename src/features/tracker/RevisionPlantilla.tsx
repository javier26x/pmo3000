import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { NOMBRES_TIPO, TIPOS_CAMPO, type TipoCampo } from '@/domain/tracker/campos'
import type { ColumnaInferida, PlantillaInferida } from '@/domain/tracker/inferencia'
import type { IndiceColumnas } from '@/domain/tracker/aplicacion'
import { Aviso, Insignia, Selector, cn } from '@/components/ui'

/** Hasta tres nombres con su conteo; el resto se resume. */
function listar(columnas: readonly ColumnaInferida[]): string {
  const visibles = columnas.slice(0, 3).map((c) => `${c.encabezado} (${c.noConvertibles})`)
  return columnas.length > 3
    ? `${visibles.join(', ')} y ${columnas.length - 3} más`
    : visibles.join(', ')
}

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

/**
 * Una columna de la propuesta.
 *
 * El tipo solo se puede elegir en las columnas que se guardan como campo del
 * sitio. El estado, el comentario y la fecha de una revision no son campos
 * libres: viajan dentro de su disciplina y se leen siempre igual, asi que
 * ofrecer un selector ahi seria ofrecer algo que no hace nada.
 */
function FilaColumna({
  columna: c,
  editable,
  onCambiarTipo,
}: {
  columna: ColumnaInferida
  editable: boolean
  onCambiarTipo: (indiceColumna: number, tipo: TipoCampo) => void
}) {
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-xs whitespace-nowrap">
      <span className={cn('w-20 shrink-0 font-medium', TONO_ROL[c.rol])}>{c.rol}</span>
      {editable ? (
        <Selector
          value={c.campo.tipo}
          aria-label={`Tipo de la columna ${c.encabezado}`}
          className="h-6 w-32 shrink-0 py-0 text-xs"
          onChange={(e) => onCambiarTipo(c.indice, e.target.value as TipoCampo)}
        >
          {TIPOS_CAMPO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {NOMBRES_TIPO[tipo]}
            </option>
          ))}
        </Selector>
      ) : (
        <span
          className="w-32 shrink-0 text-texto-3"
          title={
            c.revision !== null
              ? `Estado de la revisión de ${c.revision}`
              : 'Va dentro de su revisión, no como campo del sitio'
          }
        >
          {c.revision !== null ? `estado de ${c.revision}` : 'de la revisión'}
        </span>
      )}
      <span className="min-w-0 truncate">{c.encabezado}</span>
      {c.revision !== null && <Insignia tono="neutro">{c.revision}</Insignia>}
      <span className="ml-auto shrink-0 text-texto-3">{Math.round(c.llenado * 100)}% con dato</span>
      {c.noConvertibles > 0 && (
        <span
          title={`${c.noConvertibles} celdas no calzan con este tipo y entrarían vacías. Cámbialo a Texto para no perderlas.`}
          className="flex shrink-0 items-center gap-0.5 text-[var(--riesgo-fg)]"
        >
          <AlertTriangle aria-hidden className="size-3" />
          {c.noConvertibles}
        </span>
      )}
    </li>
  )
}

export function RevisionPlantillaInferida({
  propuesta,
  indice,
  onCambiarTipo,
}: {
  propuesta: PlantillaInferida
  indice: IndiceColumnas
  onCambiarTipo: (indiceColumna: number, tipo: TipoCampo) => void
}) {
  const [abierta, setAbierta] = useState<string | null>(propuesta.etapas[0]?.nombre ?? null)

  const identidadFaltante = (['id', 'nombre'] as const).filter(
    (k) => propuesta.identidad[k] === undefined,
  )

  // Las columnas que no cayeron en ninguna etapa tambien se pueden revisar: son
  // casi una de cada cuatro, y si el aviso de arriba se queja del tipo de alguna
  // de ellas, sin esto no habria donde corregirlo.
  const conProblemas = propuesta.columnas.filter((c) => c.noConvertibles > 0)
  // Se separan las que la persona puede arreglar de las que no: decirle "cambia
  // el tipo" sobre una columna sin selector es mandarla a buscar algo que no
  // existe.
  const editable = (c: ColumnaInferida) => indice.campos.some((k) => k.indice === c.indice)
  const corregibles = conProblemas.filter(editable)
  const deRevision = conProblemas.filter((c) => !editable(c))
  const indicesIdentidad = new Set(Object.values(propuesta.identidad))
  const sinEtapa = propuesta.columnas.filter(
    (c) => c.etapa === null && !indicesIdentidad.has(c.indice),
  )

  return (
    <div className="flex flex-col gap-3">
      {propuesta.avisos.map((aviso) => (
        <Aviso key={aviso} tono="riesgo" titulo="Revisa esto antes de importar">
          {aviso}
        </Aviso>
      ))}

      {conProblemas.length > 0 && (
        <Aviso tono="riesgo" titulo="Celdas que no calzan con su tipo">
          {corregibles.length > 0 && (
            <p>
              {corregibles.length} columna(s) tienen celdas que el tipo elegido no puede leer y
              entrarían vacías: {listar(corregibles)}. Cámbialas a <strong>Texto</strong> más abajo
              y el aviso se va.
            </p>
          )}
          {deRevision.length > 0 && (
            <p className={corregibles.length > 0 ? 'mt-2' : undefined}>
              Otras {deRevision.length} son la fecha de una revisión ({listar(deRevision)}), y ahí
              el tipo no se puede cambiar: la fecha de una revisión se lee siempre como fecha. Esas
              celdas concretas entrarán vacías; el resto de la columna se importa igual.
            </p>
          )}
        </Aviso>
      )}

      <section className="rounded-lg border border-borde bg-superficie p-3">
        <h3 className="mb-1 text-md">El proceso que se detectó</h3>
        <p className="mb-3 text-xs text-texto-2">
          Las etapas salen de las columnas <code className="font-mono">Status</code> y su orden es
          el orden de las columnas en la planilla, que es el orden real del proceso. Dentro de cada
          etapa, cada disciplina que revisa queda con su propio estado, comentario y fecha.
          <br />
          El tipo de cada columna se puede corregir acá: el número en rojo dice cuántas celdas no
          calzan con el tipo elegido, y se recalcula al cambiarlo.
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
                      <FilaColumna
                        key={c.campo.id}
                        columna={c}
                        editable={indice.campos.some((k) => k.indice === c.indice)}
                        onCambiarTipo={onCambiarTipo}
                      />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      {sinEtapa.length > 0 && (
        <section className="rounded-lg border border-borde bg-superficie p-3">
          <h3 className="mb-1 text-md">Columnas que no son de ninguna etapa</h3>
          <p className="mb-2 text-xs text-texto-2">
            Atributos del sitio dentro del proyecto: lo que va antes del primer bloque de etapas y
            lo que va después del último. Acá suelen estar la vigencia, el operador, el tipo de
            estructura y las marcas de plan.
          </p>
          <ul>
            {sinEtapa.map((c) => (
              <FilaColumna
                key={c.campo.id}
                columna={c}
                editable={indice.campos.some((k) => k.indice === c.indice)}
                onCambiarTipo={onCambiarTipo}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-borde bg-superficie p-3">
        <h3 className="mb-1 text-md">Qué identifica a cada sitio</h3>
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
