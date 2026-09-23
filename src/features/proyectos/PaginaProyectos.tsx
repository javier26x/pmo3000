import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FolderKanban, Plus, Timer, Users } from 'lucide-react'
import { Boton, CabeceraPantalla, Cargando, EstadoVacio, Insignia, Metrica } from '@/components/ui'
import { DialogoCatalogo } from '@/features/admin/PaginaConfiguracion'
import { NOMBRES_ESTADO_PROGRAMA } from '@/domain/tipos'
import { resumirProyecto } from '@/domain/vistas/proyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useMedidorSla } from '@/hooks/useSla'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { TONO_ESTADO } from './comun'

/**
 * Los proyectos, cada uno con su foto: cuantos sitios, cuantos fuera de SLA y
 * si ya tiene SLA y revisores. Desde aca se entra a la ficha, que es donde se
 * configura todo lo del proyecto.
 */
export function PaginaProyectos() {
  useTituloPagina('Proyectos')
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const catalogos = useCatalogos()
  const { cargando: cargandoCatalogos, proyectos, areas, nombrePrograma, nombreCelula } = catalogos
  const { seguimientos, hoy, cargando } = useDespliegue()
  const medirSla = useMedidorSla()
  const [creando, setCreando] = useState(false)

  const filas = useMemo(
    () =>
      [...proyectos]
        .sort(
          (a, b) =>
            Number(a.estado === 'cerrado') - Number(b.estado === 'cerrado') ||
            a.nombre.localeCompare(b.nombre, 'es'),
        )
        .map((p) => ({
          proyecto: p,
          resumen: resumirProyecto(seguimientos, p.id, (sp) => medirSla(sp, hoy).estado),
          conRevisores: areas.filter((a) => a.activa && (a.porProyecto[p.id]?.length ?? 0) > 0)
            .length,
        })),
    [proyectos, seguimientos, medirSla, hoy, areas],
  )

  if (cargandoCatalogos) return <Cargando texto="Cargando proyectos…" />

  return (
    <>
      <CabeceraPantalla
        titulo="Proyectos"
        descripcion="Cada proyecto es un tramo de un programa con sus propios sitios, SLA y personas que revisan. Entra a uno para configurarlo."
        acciones={
          puedeHacer('proyectos', 'crear') ? (
            <Boton
              variante="primario"
              icono={<Plus aria-hidden className="size-4" />}
              onClick={() => setCreando(true)}
            >
              Nuevo proyecto
            </Boton>
          ) : null
        }
      />

      <div className="p-4">
        {filas.length === 0 ? (
          <EstadoVacio
            icono={<FolderKanban aria-hidden className="size-6" />}
            titulo="Todavía no hay proyectos"
            descripcion="Un proyecto agrupa los sitios de un plan (por ejemplo, 5G Plan 200) dentro de un programa."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filas.map(({ proyecto: p, resumen: r, conRevisores }) => (
              <li key={p.id}>
                <Link
                  to={`/proyectos/${encodeURIComponent(p.id)}`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-borde bg-superficie p-3 transition-colors hover:border-borde-fuerte hover:bg-superficie-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="truncate text-xs text-texto-2">
                        {nombrePrograma(p.programaId)}
                        {p.celulaId ? ` · ${nombreCelula(p.celulaId)}` : ''}
                      </p>
                    </div>
                    <Insignia tono={TONO_ESTADO[p.estado]}>
                      {NOMBRES_ESTADO_PROGRAMA[p.estado]}
                    </Insignia>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <Metrica etiqueta="Sitios vigentes" valor={cargando ? '…' : r.vigentes} />
                    <Metrica
                      etiqueta="Fuera de SLA"
                      valor={cargando ? '…' : p.sla ? r.fueraDeSla : '—'}
                      tono={r.fueraDeSla > 0 ? 'error' : 'neutro'}
                    />
                    <Metrica etiqueta="En hold" valor={cargando ? '…' : r.bloqueados} />
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
                    <Insignia tono={p.sla ? 'ok' : 'neutro'}>
                      <Timer aria-hidden className="size-3" />
                      {p.sla ? 'Con SLA' : 'Sin SLA'}
                    </Insignia>
                    <Insignia tono={conRevisores > 0 ? 'ok' : 'neutro'}>
                      <Users aria-hidden className="size-3" />
                      {conRevisores > 0
                        ? `Revisores propios en ${conRevisores} área(s)`
                        : 'Revisores por defecto'}
                    </Insignia>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creando && (
        <DialogoCatalogo
          edicion={{ tipo: 'proyecto', existente: null }}
          onCerrar={() => setCreando(false)}
          catalogos={catalogos}
          actor={actor}
        />
      )}
    </>
  )
}
