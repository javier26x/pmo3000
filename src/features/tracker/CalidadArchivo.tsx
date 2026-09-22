import { ClipboardCheck } from 'lucide-react'
import type { CalidadArchivo } from '@/domain/tracker/calidad'
import { NOMBRES_ESTADO_SITIO } from '@/domain/tracker/estadoSitio'
import { Insignia } from '@/components/ui'

const TEXTO_TIPO = {
  vigencia: 'Vigencia contradictoria',
  trackerAtrasado: 'Status Sitio atrasado',
  trackerAdelantado: 'Status Sitio adelantado',
} as const

/** Un conteo con su explicacion corta. */
function Cifra({ valor, etiqueta, ayuda }: { valor: number; etiqueta: string; ayuda: string }) {
  return (
    <div className="rounded border border-borde px-2 py-1.5" title={ayuda}>
      <div className="text-md font-semibold tabular-nums">{valor.toLocaleString('es-CL')}</div>
      <div className="text-xs text-texto-2">{etiqueta}</div>
    </div>
  )
}

/**
 * Lo que la app tuvo que interpretar del archivo, antes de importar.
 *
 * No bloquea nada: es para que quien importa sepa cuanto del tablero sale de
 * correcciones y cuanto del Excel no calza con sus propias etapas.
 */
export function PanelCalidadArchivo({ calidad }: { calidad: CalidadArchivo }) {
  const porcentaje =
    calidad.comparables === 0
      ? null
      : Math.round((calidad.coincidencias / calidad.comparables) * 100)

  return (
    <section className="rounded-lg border border-borde bg-superficie p-3">
      <h3 className="mb-1 flex items-center gap-2 text-md">
        <ClipboardCheck aria-hidden className="size-4 text-texto-3" />
        Calidad del archivo
      </h3>
      <p className="mb-3 text-xs text-texto-2">
        Nada de esto frena la importación. Es lo que la app tuvo que interpretar para leer el
        tracker, y lo que el propio Excel no tiene coherente.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Cifra
          valor={calidad.corregidas}
          etiqueta="erratas corregidas"
          ayuda='Estados con una errata que se corrigió para clasificarlos ("Finaliazada", "Apobada").'
        />
        <Cifra
          valor={calidad.ceros}
          etiqueta='celdas "0"'
          ayuda="Celdas de estado con un 0: fórmulas sobre celdas vacías. Se leen como sin dato, no como cerradas."
        />
        <Cifra
          valor={calidad.fechas}
          etiqueta="fechas en estados"
          ayuda="Celdas de estado que traen una fecha. Se leen como hecho ese día."
        />
        <Cifra
          valor={calidad.noVigentes}
          etiqueta="no vigentes"
          ayuda="Se importan igual, marcados como no vigentes: salen de la lista por defecto."
        />
        <Cifra
          valor={calidad.enHold}
          etiqueta="On Hold"
          ayuda='La fase dice "On Hold": se importan bloqueados, con el motivo que trae el tracker.'
        />
      </div>

      {porcentaje !== null && (
        <div className="mt-3">
          <p className="text-sm">
            El <strong>Status Sitio</strong> del Excel coincide con lo que dicen sus etapas en{' '}
            <strong>{porcentaje}%</strong> de los sitios ({calidad.coincidencias} de{' '}
            {calidad.comparables}).
          </p>
          {calidad.discrepancias > 0 && (
            <>
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-texto-2">
                {(Object.keys(TEXTO_TIPO) as (keyof typeof TEXTO_TIPO)[])
                  .filter((t) => calidad.porTipo[t] > 0)
                  .map((t) => (
                    <Insignia key={t} tono={t === 'trackerAdelantado' ? 'riesgo' : 'neutro'}>
                      {TEXTO_TIPO[t]}: {calidad.porTipo[t]}
                    </Insignia>
                  ))}
              </p>
              <p className="mt-1 text-xs text-texto-3">
                Atrasado: el Excel dice una etapa anterior a la que ya aprobaron las etapas (la
                columna no se actualizó). Adelantado: dice una posterior, y falta registrar algo en
                las etapas. La app usa lo que dicen las etapas.
              </p>
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-texto-3">
                  <tr>
                    <th className="py-0.5 pr-2 font-medium">ID</th>
                    <th className="py-0.5 pr-2 font-medium">El Excel dice</th>
                    <th className="py-0.5 font-medium">Las etapas dicen</th>
                  </tr>
                </thead>
                <tbody>
                  {calidad.ejemplos.map((e) => (
                    <tr key={e.sitioId} className="border-t border-borde">
                      <td className="py-0.5 pr-2 font-mono">{e.sitioId}</td>
                      <td className="py-0.5 pr-2">{e.tracker}</td>
                      <td className="py-0.5">{NOMBRES_ESTADO_SITIO[e.derivado]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </section>
  )
}
