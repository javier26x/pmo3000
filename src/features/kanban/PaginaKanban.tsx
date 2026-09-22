import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Columns3, Info } from 'lucide-react'
import {
  Aviso,
  CabeceraPantalla,
  Cargando,
  Dialogo,
  Boton,
  Campo,
  Entrada,
  AreaTexto,
  Tabs,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { aplicarParche } from '@/data/repos/sitioProyectos'
import { hoyEnChile } from '@/domain/fechas'
import { CERRADO, nombreGate, type GateActual } from '@/domain/gates/catalogo'
import {
  contextoDe,
  evaluarMovimiento,
  planAvanzarGate,
  planRetrocederGate,
} from '@/domain/gates/maquina'
import { agruparPorGate } from '@/domain/vistas/filtrado'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { useDespliegue } from '@/hooks/useDespliegue'
import { BarraFiltros } from '@/features/sitios/BarraFiltros'
import { ColumnaGate } from './ColumnaGate'
import { TarjetaKanban } from './TarjetaKanban'

type Vista = 'gates' | 'celulas'

/** Tope por columna: dibujar 2.000 tarjetas no ayuda a nadie a ver el cuello de botella. */
const TOPE_COLUMNA = 60

export function PaginaKanban() {
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const { plantillaPorId, nombreProveedor, celulas } = useCatalogos()
  const { etapas } = useCatalogos()
  const { visibles, cargando, error, hoy } = useDespliegue()

  const [vista, setVista] = useState<Vista>('gates')
  useTituloPagina('Kanban')
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<{
    sp: SitioProyecto
    destino: GateActual
    tipo: 'avance' | 'retroceso'
  } | null>(null)
  const [fechaCierre, setFechaCierre] = useState(hoyEnChile())
  const [motivo, setMotivo] = useState('')

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Sensor de teclado: el kanban tiene que ser operable sin mouse.
    useSensor(KeyboardSensor),
  )

  const grupos = useMemo(() => agruparPorGate(visibles), [visibles])
  const gateArrastrado = arrastrando
    ? (visibles.find((sp) => sp.id === arrastrando)?.gateActual ?? null)
    : null
  const columnas: GateActual[] = [...etapas.map((e) => e.codigo), CERRADO]

  const porCelula = useMemo(() => {
    const mapa = new Map<string, SitioProyecto[]>()
    for (const sp of visibles) {
      const clave = sp.celulaId ?? 'sin-celula'
      const lista = mapa.get(clave)
      if (lista) lista.push(sp)
      else mapa.set(clave, [sp])
    }
    return mapa
  }, [visibles])

  const alTerminarArrastre = (evento: DragEndEvent) => {
    setArrastrando(null)
    const idTarjeta = String(evento.active.id)
    const destino = evento.over ? (String(evento.over.id) as GateActual) : null
    if (!destino) return

    const sp = visibles.find((s) => s.id === idTarjeta)
    if (!sp) return

    const plantilla = plantillaPorId(sp.gateTemplateId)
    if (!plantilla) {
      avisar.error('Falta la plantilla de gates de este sitio')
      return
    }

    const evaluacion = evaluarMovimiento(sp, plantilla, actor, destino)
    if (!evaluacion.permitido) {
      // Mensaje explicito: el kanban no "rebota" la tarjeta sin explicar por que.
      avisar.error(evaluacion.motivo ?? 'Movimiento no permitido')
      return
    }

    setFechaCierre(hoy)
    setMotivo('')
    setConfirmacion({ sp, destino, tipo: evaluacion.tipo === 'retroceso' ? 'retroceso' : 'avance' })
  }

  /**
   * No se espera la confirmación del servidor: con la caché persistente el
   * cambio ya está aplicado localmente y la tarjeta se mueve de columna al
   * instante. Esperar dejaría el diálogo colgado cuando no hay señal, que es
   * justo cuando esto se usa en terreno.
   */
  const confirmar = () => {
    if (!confirmacion) return
    const plantilla = plantillaPorId(confirmacion.sp.gateTemplateId)
    if (!plantilla) return

    const ctx = contextoDe(actor)
    const resultado =
      confirmacion.tipo === 'avance'
        ? planAvanzarGate(confirmacion.sp, plantilla, ctx, { fechaReal: fechaCierre })
        : planRetrocederGate(confirmacion.sp, plantilla, ctx, motivo)

    if (!resultado.ok) {
      avisar.error(resultado.motivo)
      return
    }

    aplicarParche(confirmacion.sp, resultado.valor, actor).catch((e) =>
      avisar.error(mensajeDeError(e)),
    )
    avisar.ok(
      confirmacion.tipo === 'avance'
        ? `${confirmacion.sp.sitioId} avanzó a ${nombreGate(confirmacion.destino, etapas)}`
        : `${confirmacion.sp.sitioId} volvió a ${nombreGate(confirmacion.destino, etapas)}`,
    )
    setConfirmacion(null)
  }

  const puedeMover = puedeHacer('sitioProyectos', 'avanzarGate')

  return (
    <>
      <CabeceraPantalla
        titulo="Kanban"
        descripcion={
          vista === 'gates'
            ? 'Columnas por gate: donde se acumulan los sitios es donde esta el cuello de botella.'
            : 'Columnas por celula: como se reparte la carga del despliegue.'
        }
        acciones={
          <Tabs
            pestanas={[
              { id: 'gates', etiqueta: 'Por gate' },
              { id: 'celulas', etiqueta: 'Por celula' },
            ]}
            activa={vista}
            onCambiar={setVista}
          />
        }
      >
        <BarraFiltros compacta />
      </CabeceraPantalla>

      <div className="min-h-0 flex-1 p-3">
        {error && (
          <Aviso tono="error" className="mb-3">
            {error}
          </Aviso>
        )}

        {puedeMover && vista === 'gates' && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-texto-3">
            <Info aria-hidden className="size-3.5" />
            Arrastra una tarjeta al gate siguiente para avanzarla. Los saltos de gate se rechazan.
          </p>
        )}

        {cargando && visibles.length === 0 ? (
          <Cargando texto="Cargando el tablero…" />
        ) : vista === 'gates' ? (
          <DndContext
            sensors={sensores}
            onDragStart={(e: DragStartEvent) => setArrastrando(String(e.active.id))}
            onDragEnd={alTerminarArrastre}
            onDragCancel={() => setArrastrando(null)}
          >
            <div className="panel-scroll flex h-full snap-x gap-2 overflow-x-auto pb-2">
              {columnas.map((gate) => (
                <ColumnaGate
                  key={gate}
                  gate={gate}
                  sitios={(grupos.get(gate) ?? []).slice(0, TOPE_COLUMNA)}
                  total={(grupos.get(gate) ?? []).length}
                  hoy={hoy}
                  gateArrastrado={gateArrastrado}
                  arrastrable={puedeMover}
                  nombreProveedor={nombreProveedor}
                />
              ))}
            </div>
          </DndContext>
        ) : (
          <div className="panel-scroll flex h-full snap-x gap-2 overflow-x-auto pb-2">
            {[...celulas, { id: 'sin-celula', nombre: 'Sin celula asignada' }].map((celula) => {
              const lista = porCelula.get(celula.id) ?? []
              return (
                <section
                  key={celula.id}
                  aria-label={celula.nombre}
                  className="flex w-72 shrink-0 snap-start flex-col rounded border border-borde bg-superficie-2"
                >
                  <header className="flex items-center gap-2 border-b border-borde px-2.5 py-2">
                    <Columns3 aria-hidden className="size-3.5 text-texto-3" />
                    <h2 className="flex-1 truncate text-sm font-semibold">{celula.nombre}</h2>
                    <span className="text-xs text-texto-3 tabular-nums">{lista.length}</span>
                  </header>
                  <div className="panel-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                    {lista.slice(0, TOPE_COLUMNA).map((sp) => (
                      <TarjetaKanban
                        key={sp.id}
                        sp={sp}
                        hoy={hoy}
                        arrastrable={false}
                        nombreProveedor={nombreProveedor(sp.proveedorId)}
                      />
                    ))}
                    {lista.length > TOPE_COLUMNA && (
                      <p className="px-1 py-2 text-center text-xs text-texto-3">
                        y {lista.length - TOPE_COLUMNA} mas — usa los filtros para acotar
                      </p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Dialogo
        abierto={confirmacion !== null}
        onCerrar={() => setConfirmacion(null)}
        titulo={
          confirmacion?.tipo === 'avance'
            ? `Avanzar ${confirmacion.sp.sitioId} a ${nombreGate(confirmacion.destino, etapas)}`
            : `Retroceder ${confirmacion?.sp.sitioId ?? ''} a ${confirmacion ? nombreGate(confirmacion.destino, etapas) : ''}`
        }
        descripcion={
          confirmacion?.tipo === 'avance'
            ? `Se cerrara ${nombreGate(confirmacion.sp.gateActual, etapas)} con la fecha real que indiques.`
            : 'El gate anterior se reabre y pierde su fecha real.'
        }
        pie={
          <>
            <Boton onClick={() => setConfirmacion(null)}>Cancelar</Boton>
            <Boton
              variante={confirmacion?.tipo === 'avance' ? 'primario' : 'peligro'}
              disabled={confirmacion?.tipo === 'retroceso' && !motivo.trim()}
              onClick={confirmar}
            >
              Confirmar
            </Boton>
          </>
        }
      >
        {confirmacion?.tipo === 'avance' ? (
          <Campo etiqueta="Fecha real de cierre" htmlFor="kanban-fecha" obligatorio>
            <Entrada
              id="kanban-fecha"
              type="date"
              max={hoy}
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
            />
          </Campo>
        ) : (
          <Campo etiqueta="Motivo del retroceso" htmlFor="kanban-motivo" obligatorio>
            <AreaTexto
              id="kanban-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se detecto un hallazgo que obliga a reabrir el gate anterior."
            />
          </Campo>
        )}
      </Dialogo>
    </>
  )
}
