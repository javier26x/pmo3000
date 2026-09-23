import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Inbox, MessageSquare } from 'lucide-react'
import {
  Aviso,
  CabeceraPantalla,
  Cargando,
  EnlaceBoton,
  EstadoVacio,
  InsigniaGate,
  Selector,
  cn,
} from '@/components/ui'
import { diasEntre } from '@/domain/fechas'
import { nombreGate } from '@/domain/gates/catalogo'
import { entradaEnEtapa } from '@/domain/sla'
import { fechaConstruccionLista } from '@/domain/areas'
import { COLOR_ESTADO, NOMBRES_ESTADO, pideAccion } from '@/domain/tracker/estados'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { usePendientes } from '@/hooks/usePendientes'
import { useSesion } from '@/hooks/useSesion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

/** Una lista de miles de filas no la lee nadie: se muestran las primeras y se filtra. */
const MAXIMO_FILAS = 300

const TODAS = ''
const MIOS = '__mios'

/**
 * Pendientes por area: que revisiones esperan a quien.
 *
 * El tracker sigue siendo la fuente (las areas responden en el Excel); esta
 * pantalla es la bandeja de cada persona: los sitios cuya etapa actual su
 * area todavia no aprueba, primero los que piden accion (observados,
 * rechazados) y los que llevan mas tiempo.
 */
export function PaginaPendientes() {
  useTituloPagina('Pendientes')
  const { perfil, puedeHacer } = useSesion()
  const { areas, usuarios, etapas, nombreProyecto, nombreUsuario } = useCatalogos()
  const { cargando, hoy } = useDespliegue()
  const { pendientes, hayAreas } = usePendientes()

  const uid = perfil?.id ?? ''
  const tengoAlgo = pendientes.some((p) => p.responsables.includes(uid))
  // null: aun no se elige, y se muestra "Mis pendientes" si la persona responde
  // por algo. No se fija al montar porque los datos pueden no haber llegado.
  const [eleccion, setEleccion] = useState<string | null>(null)
  const persona = eleccion ?? (tengoAlgo ? MIOS : TODAS)
  const [areaId, setAreaId] = useState<string>(TODAS)

  // Quienes aparecen como responsables en alguna area, para elegir a quien ver.
  const responsables = useMemo(() => {
    const ids = new Set<string>()
    for (const a of areas) {
      a.responsables.forEach((u) => ids.add(u))
      Object.values(a.porProyecto).forEach((l) => l.forEach((u) => ids.add(u)))
    }
    return usuarios.filter((u) => ids.has(u.id))
  }, [areas, usuarios])

  const filtrados = useMemo(() => {
    const quien = persona === MIOS ? uid : persona
    return pendientes
      .filter((p) => (quien === TODAS ? true : p.responsables.includes(quien)))
      .filter((p) => (areaId === TODAS ? true : p.area.id === areaId))
      .map((p) => {
        // Una revision espera desde que el sitio entro a la etapa; la Tx y la
        // IPRAN, desde que la obra quedo lista.
        const entrada = p.clase === 'tx' ? fechaConstruccionLista(p.sp) : entradaEnEtapa(p.sp)
        return { ...p, dias: entrada === null ? null : Math.max(0, diasEntre(entrada, hoy)) }
      })
      .sort(
        (a, b) =>
          Number(pideAccion(b.estado)) - Number(pideAccion(a.estado)) ||
          (b.dias ?? -1) - (a.dias ?? -1),
      )
  }, [pendientes, persona, areaId, uid, hoy])

  // Conteo por area con el filtro de persona aplicado: la vista rapida de
  // "donde esta el cuello de botella".
  const porArea = useMemo(() => {
    const quien = persona === MIOS ? uid : persona
    const conteo = new Map<string, { total: number; accion: number }>()
    for (const p of pendientes) {
      if (quien !== TODAS && !p.responsables.includes(quien)) continue
      const c = conteo.get(p.area.id) ?? { total: 0, accion: 0 }
      c.total += 1
      if (pideAccion(p.estado)) c.accion += 1
      conteo.set(p.area.id, c)
    }
    return conteo
  }, [pendientes, persona, uid])

  if (cargando) return <Cargando texto="Trayendo los pendientes…" />

  if (!hayAreas) {
    return (
      <EstadoVacio
        icono={<Inbox aria-hidden className="size-6" />}
        titulo="Todavía no hay áreas configuradas"
        descripcion="Crea las áreas que revisan (OOCC, ECE, RF, Implementación, MMOO) y asígnales personas en Configuración."
        {...(puedeHacer('areas', 'editar')
          ? { accion: <EnlaceBoton to="/configuracion">Ir a Configuración</EnlaceBoton> }
          : {})}
      />
    )
  }

  const visibles = filtrados.slice(0, MAXIMO_FILAS)

  return (
    <>
      <CabeceraPantalla
        titulo="Pendientes por área"
        descripcion="Revisiones de la etapa actual que su área aún no aprueba, y la Tx (FO, MMOO) y la IPRAN de los sitios ya construidos. Todo sale del tracker: al reimportarlo, esta lista se actualiza."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-texto-3">
            Responsable
            <div className="w-56">
              <Selector value={persona} onChange={(e) => setEleccion(e.target.value)}>
                {tengoAlgo && <option value={MIOS}>Mis pendientes</option>}
                <option value={TODAS}>Todas las personas</option>
                {responsables.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </Selector>
            </div>
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por área">
            <BotonArea
              activo={areaId === TODAS}
              onClick={() => setAreaId(TODAS)}
              nombre="Todas"
              total={[...porArea.values()].reduce((s, c) => s + c.total, 0)}
            />
            {areas
              .filter((a) => a.activa)
              .map((a) => (
                <BotonArea
                  key={a.id}
                  activo={areaId === a.id}
                  onClick={() => setAreaId(a.id)}
                  nombre={a.nombre}
                  total={porArea.get(a.id)?.total ?? 0}
                  accion={porArea.get(a.id)?.accion ?? 0}
                />
              ))}
          </div>
        </div>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {persona === MIOS && !tengoAlgo && (
          <Aviso tono="info" className="mb-3">
            No respondes por ningún área. Pide a un jefe o administrador que te asigne en
            Configuración → Áreas.
          </Aviso>
        )}

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={<Inbox aria-hidden className="size-6" />}
            titulo="Nada pendiente"
            descripcion="Con estos filtros no hay revisiones ni transmisiones esperando."
          />
        ) : (
          <div className="overflow-x-auto rounded border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-texto-3">
                <tr className="border-b border-borde">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 font-medium">Etapa</th>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Estado en el tracker</th>
                  <th className="px-3 py-2 text-right font-medium">Días esperando</th>
                  <th className="px-3 py-2 font-medium">Responde</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr
                    key={`${p.sp.id}:${p.revisionId}`}
                    className="border-b border-borde align-top last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/seguimiento/${encodeURIComponent(p.sp.id)}`}
                        className="rounded font-mono text-xs text-[var(--acento)] hover:underline"
                      >
                        {p.sp.sitioId}
                      </Link>
                      <p className="max-w-56 truncate">{p.sp.sitioNombre}</p>
                      <p className="max-w-56 truncate text-xs text-texto-3">
                        {nombreProyecto(p.sp.proyectoId)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-texto-2">
                        <InsigniaGate gate={p.etapa} />
                        {nombreGate(p.etapa, etapas)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{p.area.nombre}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          `gate-${COLOR_ESTADO[p.estado]}`,
                          'insignia-gate inline-flex rounded px-1.5 py-0.5 text-xs font-semibold',
                        )}
                        title={NOMBRES_ESTADO[p.estado]}
                      >
                        {p.texto === '' ? 'Sin dato' : p.texto}
                      </span>
                      {p.comentario !== '' && (
                        <p className="mt-1 flex max-w-md items-start gap-1 text-xs text-texto-2">
                          {p.clase === 'revision' && (
                            <MessageSquare aria-hidden className="mt-0.5 size-3 shrink-0" />
                          )}
                          <span className="line-clamp-2">{p.comentario}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.dias === null ? '—' : p.dias}
                    </td>
                    <td className="px-3 py-2 text-xs text-texto-2">
                      {p.responsables.length === 0 ? (
                        <span className="text-[var(--riesgo-fg)]">Sin asignar</span>
                      ) : (
                        p.responsables.map((u) => nombreUsuario(u)).join(', ')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length > MAXIMO_FILAS && (
              <p className="border-t border-borde px-3 py-2 text-xs text-texto-3">
                Mostrando {MAXIMO_FILAS} de {filtrados.length.toLocaleString('es-CL')}. Filtra por
                área o responsable para ver el resto.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function BotonArea({
  nombre,
  total,
  accion = 0,
  activo,
  onClick,
}: {
  nombre: string
  total: number
  accion?: number
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        'transition-colors duration-[var(--ms-instante)]',
        activo
          ? 'border-[var(--acento)] bg-[var(--acento-suave)] text-[var(--acento)]'
          : 'border-borde text-texto-2 hover:bg-superficie-2',
      )}
    >
      {nombre}
      <span className="font-semibold tabular-nums">{total}</span>
      {accion > 0 && (
        <span className="text-[var(--error-fg)] tabular-nums" title="Observados o rechazados">
          · {accion}
        </span>
      )}
    </button>
  )
}
