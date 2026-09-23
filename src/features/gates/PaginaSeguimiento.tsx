import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import {
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Unlock,
} from 'lucide-react'
import {
  AreaTexto,
  Aviso,
  BarraProgreso,
  Boton,
  CabeceraPantalla,
  Campo,
  Dialogo,
  EnlaceBoton,
  Entrada,
  EstadoVacio,
  Insignia,
  InsigniaGate,
  Metrica,
  Selector,
  Tabs,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { agregarComentario, aplicarParche, asignarResponsable } from '@/data/repos/sitioProyectos'
import { formatearFecha, formatearFechaHora, hoyEnChile } from '@/domain/fechas'
import { diasAtraso, textoAtraso } from '@/domain/gates/atraso'
import {
  CERRADO,
  gateAnterior,
  nombreGate,
  secuenciaDeGates,
  type CodigoGate,
} from '@/domain/gates/catalogo'
import {
  contextoDe,
  evaluarAvance,
  planAvanzarGate,
  planBloqueo,
  planMarcarChecklist,
  planRegistrarFecha,
  planRetrocederGate,
  porcentajeAvance,
  type Parche,
  type Resultado,
} from '@/domain/gates/maquina'
import { NOMBRES_PRIORIDAD, PRIORIDADES, type Prioridad } from '@/domain/tipos/comunes'
import { useActor, useSesion } from '@/hooks/useSesion'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { useCatalogos } from '@/hooks/useCatalogos'
import { AdministrarSeguimiento } from './AdministrarSeguimiento'
import { EsqueletoFicha } from './EsqueletoFicha'
import { Historial } from './Historial'
import { useMedidorSla } from '@/hooks/useSla'
import { areaDeRevision, indiceAreas, responsablesDe } from '@/domain/areas'
import { textoSla } from '@/domain/sla'
import { LineaGates } from './LineaGates'
import { PanelChecklist, type AccionChecklist } from './PanelChecklist'
import { PanelRevisiones } from './PanelRevisiones'
import { PanelCampos } from '@/features/sitios/PanelCampos'
import { useComentarios, useHistorial, useSeguimiento } from './useSeguimiento'

type PestanaLateral = 'comentarios' | 'historial'

export function PaginaSeguimiento() {
  const { seguimientoId } = useParams<{ seguimientoId: string }>()
  const actor = useActor()
  const { puedeHacer } = useSesion()
  const {
    plantillaPorId,
    nombrePrograma,
    nombreProyecto,
    nombreProveedor,
    proveedores,
    usuarios,
    etapas,
    areas,
    nombreUsuario,
  } = useCatalogos()
  const indice = useMemo(() => indiceAreas(areas), [areas])

  const { datos: sp, cargando, error } = useSeguimiento(seguimientoId)
  const historial = useHistorial(seguimientoId)
  const comentarios = useComentarios(seguimientoId)
  const medirSla = useMedidorSla()

  const [gateElegido, setGateElegido] = useState<CodigoGate | null>(null)
  const [pestana, setPestana] = useState<PestanaLateral>('historial')
  const [dialogo, setDialogo] = useState<'avanzar' | 'retroceder' | 'bloquear' | null>(null)
  const [fechaCierre, setFechaCierre] = useState(hoyEnChile())
  const [comentarioCierre, setComentarioCierre] = useState('')
  const [motivo, setMotivo] = useState('')
  const [nuevoComentario, setNuevoComentario] = useState('')

  const plantilla = sp ? plantillaPorId(sp.gateTemplateId) : null
  const hoy = hoyEnChile()

  useTituloPagina(sp ? `${sp.sitioId} · ${sp.sitioNombre}` : 'Sitio')

  const gateVisible: CodigoGate | null = useMemo(() => {
    if (!sp) return null
    if (gateElegido) return gateElegido
    if (sp.gateActual !== CERRADO) return sp.gateActual
    // Un sitio cerrado muestra su ultima etapa, sea cual sea su proceso.
    return secuenciaDeGates(sp.gates).at(-1) ?? null
  }, [sp, gateElegido])

  const evaluacion = useMemo(
    () => (sp && plantilla ? evaluarAvance(sp, plantilla, actor) : null),
    [sp, plantilla, actor],
  )

  if (cargando && !sp) return <EsqueletoFicha />

  if (error) {
    return (
      <div className="p-4">
        <Aviso tono="error" titulo="No pudimos cargar este sitio">
          {error}
        </Aviso>
      </div>
    )
  }

  if (!sp) {
    return (
      <EstadoVacio
        titulo="Ese seguimiento no existe"
        descripcion="Puede que el sitio se haya quitado del proyecto o que el enlace este mal."
      />
    )
  }

  if (!plantilla) {
    return (
      <div className="p-4">
        <Aviso tono="error" titulo="Falta la plantilla de gates">
          Este sitio referencia la plantilla <code>{sp.gateTemplateId}</code>, que no existe o no
          puedes leerla. Pide a un administrador que la revise.
        </Aviso>
      </div>
    )
  }

  /**
   * Aplica un plan del dominio.
   *
   * La validación es síncrona (vive en el dominio), así que un cambio inválido
   * se rechaza al instante. Lo que NO se espera es la confirmación del servidor:
   * con la caché persistente activa, Firestore aplica la escritura localmente de
   * inmediato y la promesa de `commit()` recién resuelve cuando el backend
   * responde —o nunca, si se está sin señal—. Esperarla dejaría los diálogos
   * colgados justo en terreno, que es donde más falta hacen.
   *
   * Por eso la interfaz avanza con el cambio ya aplicado y el error del servidor,
   * si llega, se avisa después.
   */
  const ejecutar = (
    resultado: Resultado<Parche>,
    mensajeOk: string | null,
    opciones: { accion?: { texto: string; ejecutar: () => void } } = {},
  ): boolean => {
    if (!resultado.ok) {
      avisar.error(resultado.motivo)
      return false
    }

    aplicarParche(sp, resultado.valor, actor).catch((e) => avisar.error(mensajeDeError(e)))
    if (mensajeOk) avisar.ok(mensajeOk, opciones.accion)
    return true
  }

  const ctx = contextoDe(actor)
  const gateActual = sp.gateActual === CERRADO ? null : sp.gates[sp.gateActual]
  const dias = diasAtraso(gateActual?.fechaPlan ?? null, gateActual?.fechaReal ?? null, hoy)
  const avance = porcentajeAvance(sp, plantilla)
  const sla = medirSla(sp, hoy)
  // Hay algo a que volver si el gate actual tiene uno anterior en la secuencia
  // de ESTE documento (desde CERRADO, la ultima etapa). No se asume ningun
  // proceso en particular.
  const tieneAnterior = gateAnterior(sp.gateActual, secuenciaDeGates(sp.gates)) !== null
  const puedeEditar =
    puedeHacer('sitioProyectos', 'editarChecklist') &&
    (actor.rol !== 'contratista' || sp.proveedorId === actor.proveedorId)

  const marcar = (accion: AccionChecklist) =>
    ejecutar(
      planMarcarChecklist(sp, plantilla, ctx, {
        codigo: accion.codigo,
        itemId: accion.itemId,
        ok: accion.ok,
        ...(accion.evidenciaUrl !== undefined ? { evidenciaUrl: accion.evidenciaUrl } : {}),
        ...(accion.obs !== undefined ? { obs: accion.obs } : {}),
      }),
      null,
    )

  return (
    <>
      <CabeceraPantalla
        migas={[
          { etiqueta: 'Sitios', ruta: '/sitios' },
          { etiqueta: sp.sitioId, ruta: `/sitios/${encodeURIComponent(sp.sitioId)}` },
          { etiqueta: nombreProyecto(sp.proyectoId) },
        ]}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-texto-2">{sp.sitioId}</span>
            {sp.sitioNombre}
            <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
            {sp.bloqueado && (
              <Insignia tono="riesgo">
                <Lock aria-hidden className="size-3" />
                Bloqueado
              </Insignia>
            )}
          </span>
        }
        descripcion={
          <span className="flex flex-wrap items-center gap-x-3">
            <span>{nombrePrograma(sp.programaId)}</span>
            <span>{nombreProyecto(sp.proyectoId)}</span>
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="size-3" />
              {sp.comuna}, {sp.region}
            </span>
            <span>Proveedor: {nombreProveedor(sp.proveedorId)}</span>
          </span>
        }
        acciones={
          <>
            {puedeHacer('sitioProyectos', 'editar') && (
              <Boton
                variante={sp.bloqueado ? 'secundario' : 'peligro'}
                icono={
                  sp.bloqueado ? (
                    <Unlock aria-hidden className="size-4" />
                  ) : (
                    <Lock aria-hidden className="size-4" />
                  )
                }
                onClick={() => {
                  setMotivo('')
                  setDialogo('bloquear')
                }}
              >
                {sp.bloqueado ? 'Desbloquear' : 'Bloquear'}
              </Boton>
            )}
            {puedeHacer('sitioProyectos', 'retrocederGate') && tieneAnterior && (
              <Boton
                icono={<ArrowLeft aria-hidden className="size-4" />}
                onClick={() => {
                  setMotivo('')
                  setDialogo('retroceder')
                }}
              >
                Retroceder
              </Boton>
            )}
            {puedeHacer('sitioProyectos', 'avanzarGate') && sp.gateActual !== CERRADO && (
              <Boton
                variante="primario"
                icono={<ArrowRight aria-hidden className="size-4" />}
                onClick={() => {
                  setFechaCierre(hoy)
                  setComentarioCierre('')
                  setDialogo('avanzar')
                }}
              >
                Avanzar gate
              </Boton>
            )}
            <AdministrarSeguimiento sp={sp} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-44 flex-1 sm:max-w-64">
            <div className="mb-1 flex items-center justify-between text-[11px] text-texto-3">
              <span>Avance del sitio</span>
              <span className="tabular-nums">{avance}%</span>
            </div>
            <BarraProgreso valor={avance} etiqueta={`Avance del sitio: ${avance}%`} />
          </div>
          <Metrica etiqueta="Gate actual" valor={nombreGate(sp.gateActual, etapas)} />
          <Metrica etiqueta="Plan" valor={formatearFecha(gateActual?.fechaPlan ?? null)} />
          <Metrica
            etiqueta="Desviacion"
            valor={textoAtraso(dias)}
            tono={dias !== null && dias > 0 ? 'error' : 'neutro'}
          />
          {sla.estado !== 'sin_sla' && sla.estado !== 'cerrado' && (
            <Metrica
              etiqueta="SLA de la etapa"
              valor={textoSla(sla)}
              tono={
                sla.estado === 'vencido'
                  ? 'error'
                  : sla.estado === 'por_vencer'
                    ? 'riesgo'
                    : 'neutro'
              }
            />
          )}
          <Metrica etiqueta="Prioridad" valor={NOMBRES_PRIORIDAD[sp.prioridad]} />
        </div>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {sp.bloqueado && sp.motivoBloqueo && (
          <Aviso tono="riesgo" titulo="Sitio bloqueado" className="mb-3">
            {sp.motivoBloqueo}
          </Aviso>
        )}

        {/* Una linea y no una lista: los mismos entregables estan justo debajo,
            en el checklist del gate, y la lista repetida empujaba la ficha fuera
            de la pantalla. El detalle completo queda en el title. */}
        {evaluacion && !evaluacion.permitido && evaluacion.itemsFaltantes.length > 0 && (
          <p
            className="mb-3 truncate rounded bg-[var(--info-bg)] px-3 py-1.5 text-sm text-[var(--info-fg)]"
            title={evaluacion.itemsFaltantes.map((i) => `• ${i.texto}`).join('\n')}
          >
            <strong className="font-medium">
              Para avanzar faltan {evaluacion.itemsFaltantes.length}{' '}
              {evaluacion.itemsFaltantes.length === 1 ? 'entregable' : 'entregables'}:
            </strong>{' '}
            <span className="opacity-80">
              {evaluacion.itemsFaltantes.map((i) => i.texto).join(' · ')}
            </span>
          </p>
        )}

        {/* En pantalla ancha: secuencia | gate + datos del tracker | asignacion e
            historial. La columna derecha queda arriba: antes, con un tracker
            importado, los datos del tracker ocupaban la tercera columna y la
            asignacion y el historial caian a una fila nueva, varios scroll abajo.
            En pantalla angosta el orden del DOM ya deja la asignacion antes de
            los ~130 campos del tracker. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(260px,340px)] lg:grid-rows-[auto_1fr]">
          <section
            aria-label="Secuencia de gates"
            className="rounded border border-borde bg-superficie p-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
          >
            <h2 className="px-2 pb-1 text-xs font-semibold text-texto-2">Secuencia de gates</h2>
            {gateVisible && (
              <LineaGates
                sp={sp}
                plantilla={plantilla}
                seleccionado={gateVisible}
                onSeleccionar={setGateElegido}
                hoy={hoy}
              />
            )}
          </section>

          <section
            aria-label="Avance del gate"
            className="rounded border border-borde bg-superficie p-3 lg:col-start-2 lg:row-start-1"
          >
            <h2 className="mb-2 text-xs font-semibold text-texto-2">
              {gateVisible ? nombreGate(gateVisible, etapas) : ''}
            </h2>

            {/* Un gate de la plantilla estandar se sigue con checklist; uno de
                un tracker importado, con las revisiones de cada disciplina.
                Pueden convivir, asi que se muestra lo que el gate tenga. */}
            {gateVisible && Object.keys(sp.gates[gateVisible]?.revisiones ?? {}).length > 0 && (
              <div className="mb-3">
                <PanelRevisiones
                  gate={sp.gates[gateVisible]!}
                  definicion={plantilla.gates.find((g) => g.codigo === gateVisible)}
                  homologacion={plantilla.homologacion}
                  {...(indice.size > 0
                    ? {
                        responde: (revision: { id: string; nombre: string }) => {
                          const area = areaDeRevision(indice, revision)
                          if (!area) return null
                          const uids = responsablesDe(area, sp.proyectoId)
                          return uids.length === 0
                            ? 'Sin responsable'
                            : uids.map((u) => nombreUsuario(u)).join(', ')
                        },
                      }
                    : {})}
                />
              </div>
            )}
            {gateVisible && (
              <PanelChecklist
                sp={sp}
                plantilla={plantilla}
                codigo={gateVisible}
                editable={puedeEditar}
                onMarcar={marcar}
                onEditarFecha={(campo, valor) =>
                  ejecutar(
                    planRegistrarFecha(sp, plantilla, ctx, {
                      codigo: gateVisible,
                      campo,
                      fecha: valor,
                    }),
                    'Fecha actualizada',
                  )
                }
              />
            )}
          </section>

          <div className="flex flex-col gap-3 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-start">
            <section
              aria-label="Asignacion"
              className="rounded border border-borde bg-superficie p-3"
            >
              <h2 className="mb-2 text-xs font-semibold text-texto-2">Asignacion</h2>
              <div className="flex flex-col gap-2">
                <Campo etiqueta="Responsable" htmlFor="responsable">
                  <Selector
                    id="responsable"
                    value={sp.responsableUid ?? ''}
                    disabled={!puedeHacer('sitioProyectos', 'editar')}
                    onChange={(e) => {
                      asignarResponsable(
                        sp,
                        {
                          responsableUid: e.target.value || null,
                          proveedorId: sp.proveedorId,
                          prioridad: sp.prioridad,
                        },
                        actor,
                      ).catch((err) => avisar.error(mensajeDeError(err)))
                      avisar.ok('Responsable actualizado')
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {usuarios
                      .filter((u) => u.activo && u.rol !== 'contratista')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                  </Selector>
                </Campo>

                <Campo etiqueta="Proveedor" htmlFor="proveedor">
                  <Selector
                    id="proveedor"
                    value={sp.proveedorId ?? ''}
                    disabled={!puedeHacer('sitioProyectos', 'editar')}
                    onChange={(e) => {
                      asignarResponsable(
                        sp,
                        {
                          responsableUid: sp.responsableUid,
                          proveedorId: e.target.value || null,
                          prioridad: sp.prioridad,
                        },
                        actor,
                      ).catch((err) => avisar.error(mensajeDeError(err)))
                      avisar.ok('Proveedor actualizado')
                    }}
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>

                <Campo etiqueta="Prioridad" htmlFor="prioridad">
                  <Selector
                    id="prioridad"
                    value={sp.prioridad}
                    disabled={!puedeHacer('sitioProyectos', 'editar')}
                    onChange={(e) => {
                      asignarResponsable(
                        sp,
                        {
                          responsableUid: sp.responsableUid,
                          proveedorId: sp.proveedorId,
                          prioridad: e.target.value as Prioridad,
                        },
                        actor,
                      ).catch((err) => avisar.error(mensajeDeError(err)))
                      avisar.ok('Prioridad actualizada')
                    }}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {NOMBRES_PRIORIDAD[p]}
                      </option>
                    ))}
                  </Selector>
                </Campo>

                <EnlaceBoton to={`/sitios/${encodeURIComponent(sp.sitioId)}`} tamano="sm">
                  <ExternalLink aria-hidden className="size-3.5" />
                  Ver ficha del sitio
                </EnlaceBoton>
              </div>
            </section>

            <section
              aria-label="Comentarios e historial"
              className="flex min-h-64 flex-col rounded border border-borde bg-superficie"
            >
              <div className="border-b border-borde p-2">
                <Tabs
                  pestanas={[
                    { id: 'historial', etiqueta: 'Historial', conteo: historial.datos.length },
                    {
                      id: 'comentarios',
                      etiqueta: 'Comentarios',
                      conteo: comentarios.datos.length,
                    },
                  ]}
                  activa={pestana}
                  onCambiar={setPestana}
                />
              </div>

              <div className="panel-scroll max-h-96 flex-1 overflow-y-auto px-2">
                {pestana === 'historial' ? (
                  <Historial
                    eventos={historial.datos}
                    cargando={historial.cargando}
                    error={historial.error}
                  />
                ) : comentarios.datos.length === 0 ? (
                  <EstadoVacio
                    icono={<MessageSquare aria-hidden className="size-6" />}
                    titulo="Sin comentarios"
                    descripcion="Deja aqui el contexto que no cabe en una fecha."
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-borde">
                    {comentarios.datos.map((c) => (
                      <li key={c.id} className="py-2">
                        <div className="flex items-center gap-2 text-[11px] text-texto-3">
                          <span className="font-medium text-texto-2">{c.nombre}</span>
                          {c.gateCodigo && <InsigniaGate gate={c.gateCodigo} />}
                          <span className="flex-1" />
                          {formatearFechaHora(c.ts)}
                        </div>
                        <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.texto}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {pestana === 'comentarios' && puedeHacer('sitioProyectos', 'comentar') && (
                <form
                  className="flex items-end gap-2 border-t border-borde p-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!nuevoComentario.trim()) return
                    agregarComentario(sp.id, nuevoComentario, gateVisible, actor).catch((err) =>
                      avisar.error(mensajeDeError(err)),
                    )
                    setNuevoComentario('')
                  }}
                >
                  <AreaTexto
                    rows={2}
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Escribe un comentario…"
                    aria-label="Nuevo comentario"
                  />
                  <Boton
                    type="submit"
                    variante="primario"
                    soloIcono
                    aria-label="Publicar comentario"
                    disabled={!nuevoComentario.trim()}
                    icono={<Send aria-hidden className="size-4" />}
                  />
                </form>
              )}
            </section>
          </div>

          {plantilla.campos.length > 0 && (
            <details
              open
              aria-label="Campos del tracker"
              className="group rounded border border-borde bg-superficie lg:col-start-2 lg:row-start-2 lg:self-start"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-texto-2 select-none">
                <ChevronRight
                  aria-hidden
                  className="size-3.5 transition-transform group-open:rotate-90"
                />
                Datos del tracker
              </summary>
              <div className="border-t border-borde p-3">
                <PanelCampos sp={sp} campos={plantilla.campos} />
              </div>
            </details>
          )}
        </div>
      </div>

      {/* --- Dialogo: avanzar gate --- */}
      <Dialogo
        abierto={dialogo === 'avanzar'}
        onCerrar={() => setDialogo(null)}
        titulo={`Cerrar ${nombreGate(sp.gateActual, etapas)} y avanzar`}
        descripcion={
          evaluacion?.destino
            ? `El sitio pasara a ${nombreGate(evaluacion.destino, etapas)}.`
            : undefined
        }
        pie={
          <>
            <Boton onClick={() => setDialogo(null)}>Cancelar</Boton>
            <Boton
              variante="primario"
              disabled={!evaluacion?.permitido}
              onClick={() => {
                const ok = ejecutar(
                  planAvanzarGate(sp, plantilla, ctx, {
                    fechaReal: fechaCierre,
                    ...(comentarioCierre.trim() ? { comentario: comentarioCierre } : {}),
                  }),
                  `${sp.sitioId} avanzó a ${nombreGate(evaluacion?.destino ?? sp.gateActual, etapas)}`,
                  {
                    accion: { texto: 'Ver el historial', ejecutar: () => setPestana('historial') },
                  },
                )
                if (ok) setDialogo(null)
              }}
            >
              Confirmar avance
            </Boton>
          </>
        }
      >
        {!evaluacion?.permitido ? (
          <Aviso tono="riesgo" titulo="Todavia no se puede avanzar">
            {evaluacion?.motivo}
            {evaluacion && evaluacion.itemsFaltantes.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {evaluacion.itemsFaltantes.map((item) => (
                  <li key={item.id}>{item.texto}</li>
                ))}
              </ul>
            )}
          </Aviso>
        ) : (
          <div className="flex flex-col gap-3">
            <Campo
              etiqueta="Fecha real de cierre"
              htmlFor="fecha-cierre"
              obligatorio
              ayuda="No puede ser una fecha futura ni anterior al cierre del gate previo."
            >
              <Entrada
                id="fecha-cierre"
                type="date"
                max={hoy}
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
              />
            </Campo>
            <Campo
              etiqueta="Comentario"
              htmlFor="comentario-cierre"
              ayuda="Opcional. Queda en la auditoria."
            >
              <AreaTexto
                id="comentario-cierre"
                value={comentarioCierre}
                onChange={(e) => setComentarioCierre(e.target.value)}
                placeholder="Ej: cierre con observaciones menores levantadas en terreno."
              />
            </Campo>
          </div>
        )}
      </Dialogo>

      {/* --- Dialogo: retroceder gate --- */}
      <Dialogo
        abierto={dialogo === 'retroceder'}
        onCerrar={() => setDialogo(null)}
        titulo="Retroceder el gate"
        descripcion="El gate anterior se reabre y pierde su fecha real. Queda registrado en la auditoria."
        pie={
          <>
            <Boton onClick={() => setDialogo(null)}>Cancelar</Boton>
            <Boton
              variante="peligro"
              disabled={!motivo.trim()}
              onClick={() => {
                const ok = ejecutar(
                  planRetrocederGate(sp, plantilla, ctx, motivo),
                  'Gate retrocedido',
                )
                if (ok) setDialogo(null)
              }}
            >
              Retroceder
            </Boton>
          </>
        }
      >
        <Campo etiqueta="Motivo del retroceso" htmlFor="motivo-retroceso" obligatorio>
          <AreaTexto
            id="motivo-retroceso"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: el acta de recepcion fue rechazada por calidad."
          />
        </Campo>
      </Dialogo>

      {/* --- Dialogo: bloquear / desbloquear --- */}
      <Dialogo
        abierto={dialogo === 'bloquear'}
        onCerrar={() => setDialogo(null)}
        titulo={sp.bloqueado ? 'Desbloquear el sitio' : 'Bloquear el sitio'}
        descripcion={
          sp.bloqueado
            ? 'El sitio vuelve a poder avanzar de gate.'
            : 'Un sitio bloqueado no puede avanzar de gate hasta que se desbloquee.'
        }
        pie={
          <>
            <Boton onClick={() => setDialogo(null)}>Cancelar</Boton>
            <Boton
              variante={sp.bloqueado ? 'primario' : 'peligro'}
              disabled={!sp.bloqueado && !motivo.trim()}
              onClick={() => {
                const ok = ejecutar(
                  planBloqueo(sp, ctx, { bloqueado: !sp.bloqueado, motivo }),
                  sp.bloqueado ? 'Sitio desbloqueado' : 'Sitio bloqueado',
                )
                if (ok) setDialogo(null)
              }}
            >
              {sp.bloqueado ? 'Desbloquear' : 'Bloquear'}
            </Boton>
          </>
        }
      >
        {sp.bloqueado ? (
          <p className="text-sm text-texto-2">
            Motivo actual: <strong>{sp.motivoBloqueo ?? 'sin registrar'}</strong>
          </p>
        ) : (
          <Campo etiqueta="Motivo del bloqueo" htmlFor="motivo-bloqueo" obligatorio>
            <AreaTexto
              id="motivo-bloqueo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: sin permiso municipal, obra detenida por la comunidad."
            />
          </Campo>
        )}
      </Dialogo>
    </>
  )
}
