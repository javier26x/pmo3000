import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Boton, EnlaceBoton, Insignia } from '@/components/ui'
import { EditorPlantilla } from '@/features/plantillas/EditorPlantilla'
import { RecorridoMini } from '@/features/plantillas/RecorridoMini'
import type { GateTemplate, Proyecto, SitioProyecto } from '@/domain/tipos'
import type { Actor } from '@/domain/tipos/comunes'

/**
 * Las etapas del proyecto, con la opcion de editarlas desde su ficha.
 *
 * La plantilla es la misma que se administra en Configuracion → Plantillas de
 * gates: se abre el mismo editor sobre el mismo documento, asi que lo que se
 * cambia aca se ve alla y al reves. Una plantilla puede ser de varios proyectos
 * (la del programa, o la de un tracker que alimenta a mas de uno): antes de
 * editar se dice cuales, porque el cambio les llega a todos.
 */
export function PlantillaDelProyecto({
  proyecto,
  idsEnUso,
  plantillas,
  proyectos,
  programaTemplateId,
  seguimientos,
  puedeEditar,
  actor,
}: {
  proyecto: Proyecto
  /** Las plantillas que usan los seguimientos del proyecto. */
  idsEnUso: readonly string[]
  plantillas: readonly GateTemplate[]
  proyectos: readonly Proyecto[]
  programaTemplateId: string | null
  seguimientos: readonly SitioProyecto[]
  puedeEditar: boolean
  actor: Actor
}) {
  const [editando, setEditando] = useState<GateTemplate | null>(null)

  // Sin sitios todavia, la plantilla es la del programa: con ella entraran.
  const ids = idsEnUso.length > 0 ? idsEnUso : programaTemplateId ? [programaTemplateId] : []
  const delProyecto = ids
    .map((id) => plantillas.find((p) => p.id === id))
    .filter((p): p is GateTemplate => p !== undefined)

  // Que otros proyectos usan cada plantilla, por sus seguimientos.
  const compartidaCon = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const sp of seguimientos) {
      if (sp.proyectoId === proyecto.id) continue
      const lista = mapa.get(sp.gateTemplateId) ?? new Set<string>()
      lista.add(sp.proyectoId)
      mapa.set(sp.gateTemplateId, lista)
    }
    return mapa
  }, [seguimientos, proyecto.id])
  const nombreProyecto = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? id

  if (delProyecto.length === 0) {
    return (
      <p className="text-sm text-texto-3">
        El proyecto todavía no tiene una plantilla: se asigna al importar su tracker o desde el
        programa.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {delProyecto.map((plantilla) => {
        const otros = [...(compartidaCon.get(plantilla.id) ?? [])].map(nombreProyecto)
        return (
          <div key={plantilla.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{plantilla.nombre}</span>
              <Insignia tono="neutro">v{plantilla.version}</Insignia>
              <span className="ml-auto flex gap-2">
                {puedeEditar && (
                  <Boton
                    tamano="sm"
                    icono={<Pencil aria-hidden className="size-3.5" />}
                    onClick={() => setEditando(plantilla)}
                  >
                    Editar etapas
                  </Boton>
                )}
                <EnlaceBoton to="/configuracion" tamano="sm" variante="fantasma">
                  Ver en Configuración
                </EnlaceBoton>
              </span>
            </div>
            <RecorridoMini etapas={plantilla.gates} nombre={plantilla.nombre} />
            {otros.length > 0 && (
              <p className="text-xs text-texto-3">
                También la usan: {otros.join(', ')}. Lo que cambies aquí les llega a esos proyectos.
              </p>
            )}
          </div>
        )
      })}

      {editando && (
        <EditorPlantilla
          key={editando.id}
          original={editando}
          inicial={editando}
          actor={actor}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
