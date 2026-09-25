import { Fragment, useMemo, useState } from 'react'
import { Timer } from 'lucide-react'
import {
  CabeceraPantalla,
  Cargando,
  EstadoVacio,
  InsigniaGate,
  Selector,
  cn,
} from '@/components/ui'
import { resumirTiempos, textoDias, tiemposDelSitio, type ResumenTiempos } from '@/domain/tiempos'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useTituloPagina } from '@/hooks/useTituloPagina'

const TODOS = ''

/**
 * Tiempos por etapa y por validador.
 *
 * Responde "cuanto nos toma cada etapa y quien la hace larga". El reloj de una
 * etapa arranca cuando cerro la anterior (el TSS aprobado por todos arranca la
 * Ingenieria), y el de cada validador corre desde ese mismo momento hasta la
 * fecha en que aprueba. Ver domain/tiempos.
 */
export function PaginaTiempos() {
  useTituloPagina('Tiempos')
  const { seguimientos, cargando, hoy } = useDespliegue()
  const { proyectos, plantillaPorId, nombreProyecto } = useCatalogos()
  const [proyectoId, setProyectoId] = useState<string>(TODOS)

  const conSeguimientos = useMemo(() => {
    const ids = new Set(seguimientos.map((sp) => sp.proyectoId))
    return proyectos.filter((p) => ids.has(p.id))
  }, [seguimientos, proyectos])

  const resumen = useMemo(() => {
    const habiles = new Map(proyectos.map((p) => [p.id, p.sla?.habiles ?? false]))
    const tiempos = seguimientos
      .filter((sp) => sp.vigente !== false)
      .filter((sp) => proyectoId === TODOS || sp.proyectoId === proyectoId)
      .map((sp) =>
        tiemposDelSitio(sp, plantillaPorId(sp.gateTemplateId), hoy, habiles.get(sp.proyectoId)),
      )
    return resumirTiempos(tiempos).filter(
      (e) =>
        e.cerradas.n + e.enCurso.n > 0 || e.revisiones.some((r) => r.cerradas.n + r.enCurso.n > 0),
    )
  }, [seguimientos, proyectos, plantillaPorId, proyectoId, hoy])

  // La barra compara medianas entre todas las filas: la mas larga llena la celda.
  const tope = useMemo(() => {
    let max = 0
    for (const e of resumen) {
      max = Math.max(max, e.cerradas.mediana ?? 0, e.enCurso.mediana ?? 0)
      for (const r of e.revisiones) {
        max = Math.max(max, r.cerradas.mediana ?? 0, r.enCurso.mediana ?? 0)
      }
    }
    return max
  }, [resumen])

  if (cargando) return <Cargando texto="Calculando los tiempos…" />

  const unProyecto = proyectoId === TODOS ? null : proyectos.find((p) => p.id === proyectoId)

  return (
    <>
      <CabeceraPantalla
        titulo="Tiempos por etapa y validador"
        descripcion="Cada etapa cuenta desde que cerró la anterior. Cada validador cuenta desde ese mismo día hasta que aprueba. Los que aún no aprueban siguen corriendo hasta hoy. Solo sitios vigentes."
      >
        <label className="flex w-64 flex-col gap-1 text-xs text-texto-3">
          Proyecto
          <Selector value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            <option value={TODOS}>Todos los proyectos</option>
            {conSeguimientos.map((p) => (
              <option key={p.id} value={p.id}>
                {nombreProyecto(p.id)}
              </option>
            ))}
          </Selector>
        </label>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {resumen.length === 0 ? (
          <EstadoVacio
            icono={<Timer aria-hidden className="size-6" />}
            titulo="Todavía no hay tiempos que medir"
            descripcion="Hacen falta sitios con la fecha real de cierre de al menos una etapa. Llegan con el tracker."
          />
        ) : (
          <div className="overflow-x-auto rounded border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="text-xs text-texto-3">
                <tr>
                  <th rowSpan={2} className="px-3 py-2 text-left align-bottom font-medium">
                    Etapa / validador
                  </th>
                  <th colSpan={4} className="border-l border-borde px-3 pt-2 text-left font-medium">
                    Ya aprobados: cuánto tomó
                  </th>
                  <th colSpan={3} className="border-l border-borde px-3 pt-2 text-left font-medium">
                    En curso: cuánto llevan
                  </th>
                </tr>
                <tr className="border-b border-borde">
                  <th className="border-l border-borde px-3 py-1.5 text-right font-medium">
                    Sitios
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium">Mediana</th>
                  <th className="px-3 py-1.5 text-right font-medium">Promedio</th>
                  <th className="px-3 py-1.5 text-right font-medium">Máximo</th>
                  <th className="border-l border-borde px-3 py-1.5 text-right font-medium">
                    Sitios
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium">Mediana</th>
                  <th className="px-3 py-1.5 text-right font-medium">Máximo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((e) => (
                  <Fragment key={e.codigo}>
                    <tr className="border-t border-borde bg-superficie-2/60">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <InsigniaGate gate={e.codigo} />
                          {unProyecto?.sla?.dias[e.codigo] !== undefined && (
                            <span className="text-xs font-normal text-texto-3">
                              SLA {unProyecto.sla.dias[e.codigo]} d
                            </span>
                          )}
                        </span>
                      </td>
                      <Celdas r={e} tope={tope} fuerte />
                    </tr>
                    {e.revisiones.map((r) => (
                      <tr key={r.id} className="border-t border-borde/60">
                        <td className="py-1.5 pr-3 pl-9 text-texto-2">{r.nombre}</td>
                        <Celdas r={r} tope={tope} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 max-w-3xl text-xs text-texto-3">
          La mediana es el valor del sitio del medio: la mitad tardó menos y la otra mitad más. Se
          usa porque unos pocos sitios detenidos por meses no la mueven, y al promedio sí.{' '}
          {proyectos.some((p) => p.sla?.habiles)
            ? 'Los proyectos configurados en días hábiles se cuentan de lunes a viernes.'
            : 'Se cuentan días corridos.'}
        </p>
      </div>
    </>
  )
}

function Celdas({
  r,
  tope,
  fuerte = false,
}: {
  r: ResumenTiempos
  tope: number
  fuerte?: boolean
}) {
  const { cerradas, enCurso } = r
  return (
    <>
      <td className="border-l border-borde px-3 py-1.5 text-right text-texto-2 tabular-nums">
        {cerradas.n || '—'}
      </td>
      <td className="px-3 py-1.5">
        <Barra dias={cerradas.mediana} tope={tope} fuerte={fuerte} />
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">{textoDias(cerradas.promedio)}</td>
      <td className="px-3 py-1.5 text-right text-texto-2 tabular-nums">
        {textoDias(cerradas.maximo)}
      </td>
      <td className="border-l border-borde px-3 py-1.5 text-right text-texto-2 tabular-nums">
        {enCurso.n || '—'}
      </td>
      <td className="px-3 py-1.5">
        <Barra dias={enCurso.mediana} tope={tope} fuerte={fuerte} enCurso />
      </td>
      <td className="px-3 py-1.5 text-right text-texto-2 tabular-nums">
        {textoDias(enCurso.maximo)}
      </td>
    </>
  )
}

function Barra({
  dias,
  tope,
  fuerte,
  enCurso = false,
}: {
  dias: number | null
  tope: number
  fuerte: boolean
  enCurso?: boolean
}) {
  if (dias === null) return <span className="text-texto-3">—</span>
  const ancho = tope > 0 ? Math.max(2, Math.round((dias / tope) * 100)) : 0
  return (
    <span className="flex min-w-36 items-center gap-2">
      <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-superficie-2">
        <span
          className={cn(
            'block h-full rounded-full',
            enCurso ? 'bg-[var(--riesgo-fg)]' : 'bg-[var(--acento)]',
          )}
          style={{ width: `${ancho}%` }}
        />
      </span>
      <span className={cn('tabular-nums', fuerte && 'font-semibold')}>{textoDias(dias)}</span>
    </span>
  )
}
