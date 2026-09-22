import { Filter } from 'lucide-react'
import { Aviso, Casilla } from '@/components/ui'
import { filtraAlgo, type FiltroPlan, type ResumenPlan } from '@/domain/tracker/plan'

const numero = (n: number) => n.toLocaleString('es-CL')

/**
 * Que filas del tracker son de este proyecto.
 *
 * El tracker trae todos los planes, vigentes o no; en el Excel el plan se ve
 * filtrando "Proyecto" y "Vigencia". Aca se hace lo mismo, y el filtro queda
 * guardado en el proyecto para la proxima re-importacion.
 */
export function FiltroPlanTracker({
  planes,
  sinPlan,
  filtro,
  onCambiar,
  editable,
  seImportan,
  totalFilas,
}: {
  planes: readonly ResumenPlan[]
  sinPlan: number
  filtro: FiltroPlan
  onCambiar: (filtro: FiltroPlan) => void
  /** Jefe o admin: pueden cambiarlo y se guarda en el proyecto. */
  editable: boolean
  seImportan: number
  totalFilas: number
}) {
  const claves = new Set(planes.map((p) => p.clave))
  const ausentes = filtro.planes.filter((c) => !claves.has(c))
  const activo = filtraAlgo(filtro)

  const alternar = (clave: string, marcado: boolean) =>
    onCambiar({
      ...filtro,
      planes: marcado ? [...filtro.planes, clave] : filtro.planes.filter((c) => c !== clave),
    })

  return (
    <div className="rounded-lg border border-borde bg-superficie p-3">
      <h3 className="mb-1 flex items-center gap-2 text-md">
        <Filter aria-hidden className="size-4 text-texto-3" />
        Qué filas son de este proyecto
      </h3>
      <p className="mb-3 text-xs text-texto-2">
        El tracker trae todos los planes, vigentes o no. Marca los planes de la columna
        «Proyecto» que corresponden a este proyecto, igual que filtrarías el Excel. Sin marcar
        ninguno se importa el archivo completo.
      </p>

      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {planes.map((p) => (
          <Casilla
            key={p.clave}
            etiqueta={p.etiqueta}
            descripcion={`${numero(p.vigentes)} vigentes · ${numero(p.noVigentes)} no vigentes`}
            checked={filtro.planes.includes(p.clave)}
            disabled={!editable}
            onChange={(e) => alternar(p.clave, e.target.checked)}
          />
        ))}
      </div>
      {sinPlan > 0 && (
        <p className="mt-2 text-xs text-texto-3">
          {numero(sinPlan)} filas no nombran un plan («On Hold - RF», «No Vigente»…): solo se
          actualizan si su sitio ya está en el proyecto.
        </p>
      )}

      <Casilla
        className="mt-3"
        etiqueta="Solo vigentes"
        descripcion="Filas con Vigencia «Vigente». Un sitio que ya está en el proyecto y pasó a no vigente se actualiza igual, como no vigente."
        checked={filtro.soloVigentes}
        disabled={!editable || !activo}
        onChange={(e) => onCambiar({ ...filtro, soloVigentes: e.target.checked })}
      />

      {ausentes.length > 0 && (
        <Aviso tono="riesgo" className="mt-3">
          El filtro guardado incluye {ausentes.map((a) => `«${a}»`).join(', ')}, que este archivo
          no trae.
        </Aviso>
      )}

      <p className="mt-3 text-sm">
        {activo ? (
          <>
            Se importan <strong>{numero(seImportan)}</strong> de {numero(totalFilas)} filas. Los
            sitios que ya estén en el proyecto y ya no cumplan el filtro se actualizan como no
            vigentes, sin borrar su historia.
          </>
        ) : (
          <>Sin filtro: se importan las {numero(totalFilas)} filas.</>
        )}
      </p>
      {!editable && (
        <p className="mt-1 text-xs text-texto-3">
          El filtro del proyecto lo define un jefe de célula o un administrador.
        </p>
      )}
    </div>
  )
}
