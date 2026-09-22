import type { ReactNode } from 'react'
import { Filter, Search, X } from 'lucide-react'
import { Aviso, Boton, Casilla, Entrada, Metrica, Selector } from '@/components/ui'
import { usarFiltros } from '@/app/filtros'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { hayFiltrosActivos, resumirSeguimientos } from '@/domain/vistas/filtrado'
import { CODIGOS_GATE, nombreGate } from '@/domain/gates/catalogo'
import { NOMBRES_PRIORIDAD, PRIORIDADES } from '@/domain/tipos/comunes'
import { useSesion } from '@/hooks/useSesion'

/**
 * Los controles son `w-full` por diseno (dentro de un formulario llenan su
 * columna). En una barra de herramientas el ancho lo fija este envoltorio, no
 * una clase que compita con `w-full` en la hoja de estilos.
 */
function Filtro({ ancho, children }: { ancho: string; children: ReactNode }) {
  return <div className={ancho}>{children}</div>
}

/** Barra de filtros compartida por la tabla, el mapa y el kanban. */
export function BarraFiltros({ compacta = false }: { compacta?: boolean }) {
  const { perfil } = useSesion()
  const { programas, proyectos, proveedores, celulas } = useCatalogos()
  const { seguimientos, visibles, regiones, comunas, hoy, truncado, tope } = useDespliegue()
  const servidor = usarFiltros((e) => e.servidor)
  const vista = usarFiltros((e) => e.vista)
  const fijarServidor = usarFiltros((e) => e.fijarServidor)
  const fijarVista = usarFiltros((e) => e.fijarVista)
  const limpiar = usarFiltros((e) => e.limpiar)

  const resumen = resumirSeguimientos(visibles, hoy)
  const proyectosVisibles = servidor.programaId
    ? proyectos.filter((p) => p.programaId === servidor.programaId)
    : proyectos
  const activos = hayFiltrosActivos(vista) || Object.values(servidor).some((v) => v !== null)
  const esContratista = perfil?.rol === 'contratista'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-texto-3"
          />
          <Entrada
            type="search"
            value={vista.texto}
            onChange={(e) => fijarVista({ texto: e.target.value })}
            placeholder="ID, nombre o comuna…"
            aria-label="Buscar sitios"
            className="pl-7"
          />
        </div>

        {!esContratista && (
          <Filtro ancho="w-44">
            <Selector
              value={servidor.programaId ?? ''}
              onChange={(e) =>
                fijarServidor({ programaId: e.target.value || null, proyectoId: null })
              }
              aria-label="Filtrar por programa"
            >
              <option value="">Todos los programas</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Filtro>
        )}

        {!esContratista && (
          <Filtro ancho="w-44">
            <Selector
              value={servidor.proyectoId ?? ''}
              onChange={(e) => fijarServidor({ proyectoId: e.target.value || null })}
              aria-label="Filtrar por proyecto"
            >
              <option value="">Todos los proyectos</option>
              {proyectosVisibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Filtro>
        )}

        <Filtro ancho="w-32">
          <Selector
            value={servidor.gateActual ?? ''}
            onChange={(e) =>
              fijarServidor({ gateActual: (e.target.value || null) as typeof servidor.gateActual })
            }
            aria-label="Filtrar por gate"
          >
            <option value="">Todo gate</option>
            {CODIGOS_GATE.map((g) => (
              <option key={g} value={g}>
                {nombreGate(g)}
              </option>
            ))}
            <option value="CERRADO">Cerrado</option>
          </Selector>
        </Filtro>

        {!esContratista && (
          <Filtro ancho="w-40">
            <Selector
              value={servidor.proveedorId ?? ''}
              onChange={(e) => fijarServidor({ proveedorId: e.target.value || null })}
              aria-label="Filtrar por proveedor"
            >
              <option value="">Todo proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Filtro>
        )}

        {!compacta && (
          <>
            <Filtro ancho="w-40">
              <Selector
                value={servidor.celulaId ?? ''}
                onChange={(e) => fijarServidor({ celulaId: e.target.value || null })}
                aria-label="Filtrar por celula"
              >
                <option value="">Toda celula</option>
                {celulas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Filtro>

            <Filtro ancho="w-40">
              <Selector
                value={vista.region ?? ''}
                onChange={(e) => fijarVista({ region: e.target.value || null, comuna: null })}
                aria-label="Filtrar por region"
              >
                <option value="">Toda region</option>
                {regiones.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Selector>
            </Filtro>

            <Filtro ancho="w-36">
              <Selector
                value={vista.comuna ?? ''}
                onChange={(e) => fijarVista({ comuna: e.target.value || null })}
                aria-label="Filtrar por comuna"
              >
                <option value="">Toda comuna</option>
                {comunas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selector>
            </Filtro>

            <Filtro ancho="w-32">
              <Selector
                value={vista.prioridad ?? ''}
                onChange={(e) =>
                  fijarVista({ prioridad: (e.target.value || null) as typeof vista.prioridad })
                }
                aria-label="Filtrar por prioridad"
              >
                <option value="">Toda prioridad</option>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {NOMBRES_PRIORIDAD[p]}
                  </option>
                ))}
              </Selector>
            </Filtro>
          </>
        )}

        <div className="flex items-center gap-3 pl-1">
          <Casilla
            etiqueta={<span className="text-xs whitespace-nowrap">Solo atrasados</span>}
            checked={vista.soloAtrasados}
            onChange={(e) => fijarVista({ soloAtrasados: e.target.checked })}
          />
          <Casilla
            etiqueta={<span className="text-xs whitespace-nowrap">Bloqueados</span>}
            checked={vista.soloBloqueados}
            onChange={(e) => fijarVista({ soloBloqueados: e.target.checked })}
          />
        </div>

        {activos && (
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={limpiar}
            icono={<X aria-hidden className="size-3.5" />}
          >
            Limpiar
          </Boton>
        )}
      </div>

      {truncado && (
        <Aviso tono="riesgo" titulo="Vista parcial">
          Se estan mostrando {tope.toLocaleString('es-CL')} seguimientos, que es el maximo por
          consulta. Filtra por programa o por proyecto para trabajar sobre el conjunto completo.
        </Aviso>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded border border-borde bg-superficie-2 px-3 py-1.5">
        <Filter aria-hidden className="size-3.5 text-texto-3" />
        <Metrica
          etiqueta={truncado ? 'Visibles (parcial)' : 'Visibles'}
          valor={resumen.total.toLocaleString('es-CL')}
        />
        <Metrica
          etiqueta="Atrasados"
          valor={resumen.atrasados.toLocaleString('es-CL')}
          tono={resumen.atrasados > 0 ? 'error' : 'neutro'}
        />
        <Metrica
          etiqueta="Bloqueados"
          valor={resumen.bloqueados.toLocaleString('es-CL')}
          tono={resumen.bloqueados > 0 ? 'riesgo' : 'neutro'}
        />
        <Metrica etiqueta="Cerrados" valor={resumen.cerrados.toLocaleString('es-CL')} tono="ok" />
        <span className="text-[11px] text-texto-3">
          de {seguimientos.length.toLocaleString('es-CL')} {truncado ? 'traidos' : 'en seguimiento'}
        </span>
      </div>
    </div>
  )
}
