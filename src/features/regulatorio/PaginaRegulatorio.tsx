import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Scale } from 'lucide-react'
import {
  Aviso,
  BarraProgreso,
  CabeceraPantalla,
  Cargando,
  EstadoVacio,
  Insignia,
  Metrica,
  Selector,
  cn,
} from '@/components/ui'
import { observarRegulatorio } from '@/data/repos/regulatorio'
import { diasEntre, formatearFecha } from '@/domain/fechas'
import {
  avanceDe,
  carpetasPara,
  expedienteCompleto,
  fechaAlAire,
  modalidadDe,
  NOMBRES_MODALIDAD,
  type Modalidad,
  type RegistroRegulatorio,
} from '@/domain/regulatorio'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useSesion } from '@/hooks/useSesion'
import { useSuscripcion } from '@/hooks/useSuscripcion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

const MAXIMO_FILAS = 400
const SIN_REGISTROS: RegistroRegulatorio[] = []

type FiltroEstado = '' | 'sin_iniciar' | 'en_curso' | 'observado' | 'completo'

const NOMBRES_FILTRO_ESTADO: Record<Exclude<FiltroEstado, ''>, string> = {
  sin_iniciar: 'Sin iniciar',
  en_curso: 'En curso',
  observado: 'Con observaciones',
  completo: 'Completo',
}

/**
 * Regulatorio: los sitios que ya salieron al aire y su expediente legal.
 *
 * Salir al aire es lo que dispara el proceso: todo seguimiento al aire aparece
 * aca, por proyecto, con cuanto lleva de cada carpeta (terreno, DOM, SUBTEL,
 * recepcion y, en los de concurso, la carpeta de la localidad). El proyecto va
 * en la URL (`?proyecto=`), asi que el enlace "Regulatorio" de la ficha de un
 * proyecto abre esta pantalla ya acotada.
 */
export function PaginaRegulatorio() {
  useTituloPagina('Regulatorio')
  const { actor } = useSesion()
  const { proyectos, nombreProyecto } = useCatalogos()
  const { seguimientos, cargando, hoy } = useDespliegue()
  // Parametro propio y no el `proy` de los filtros: ese acota la consulta del
  // despliegue en el servidor, y aca hacen falta todos los proyectos para
  // contar cuantos sitios al aire tiene cada uno.
  const [params, setParams] = useSearchParams()
  const proyectoId = params.get('proyecto') || null
  const elegirProyecto = (id: string | null) =>
    setParams(id ? { proyecto: id } : {}, { preventScrollReset: true })

  const [modalidad, setModalidad] = useState<'' | Modalidad>('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('')

  const suscribir = useCallback(
    (cb: (d: RegistroRegulatorio[]) => void, onError: (e: Error) => void) =>
      actor ? observarRegulatorio(actor, proyectoId, cb, onError) : () => {},
    [actor, proyectoId],
  )
  const registros = useSuscripcion(actor ? suscribir : null, SIN_REGISTROS)

  const porId = useMemo(() => new Map(registros.datos.map((r) => [r.id, r])), [registros.datos])

  // Todo seguimiento vigente al aire entra al proceso.
  const filas = useMemo(() => {
    const resultado = []
    for (const sp of seguimientos) {
      if (sp.vigente === false) continue
      if (proyectoId && sp.proyectoId !== proyectoId) continue
      const aire = fechaAlAire(sp)
      if (!aire.alAire) continue
      const registro = porId.get(sp.id) ?? null
      const mod = modalidadDe(sp, registro)
      const carpetas = carpetasPara(mod).map((c) => ({
        carpeta: c,
        avance: avanceDe(c.documentos, registro),
      }))
      const avance = avanceDe(
        carpetas.flatMap((c) => c.carpeta.documentos),
        registro,
      )
      const estado: Exclude<FiltroEstado, ''> = expedienteCompleto(avance)
        ? 'completo'
        : avance.observados > 0
          ? 'observado'
          : registro === null || avance.listos + avance.enTramite === 0
            ? 'sin_iniciar'
            : 'en_curso'
      resultado.push({
        sp,
        registro,
        modalidad: mod,
        fecha: aire.fecha,
        dias: aire.fecha ? Math.max(0, diasEntre(aire.fecha, hoy)) : null,
        carpetas,
        avance,
        estado,
      })
    }
    // Primero lo que lleva mas tiempo al aire sin cerrar.
    return resultado.sort(
      (a, b) =>
        Number(a.estado === 'completo') - Number(b.estado === 'completo') ||
        (b.dias ?? -1) - (a.dias ?? -1),
    )
  }, [seguimientos, proyectoId, porId, hoy])

  const conteoProyectos = useMemo(() => {
    const m = new Map<string, number>()
    for (const sp of seguimientos) {
      if (sp.vigente === false || !fechaAlAire(sp).alAire) continue
      m.set(sp.proyectoId, (m.get(sp.proyectoId) ?? 0) + 1)
    }
    return m
  }, [seguimientos])

  const filtradas = filas.filter(
    (f) =>
      (modalidad === '' || f.modalidad === modalidad) &&
      (filtroEstado === '' || f.estado === filtroEstado),
  )

  const resumen = useMemo(() => {
    const r = { total: filas.length, concurso: 0, completos: 0, observados: 0, sinIniciar: 0 }
    for (const f of filas) {
      if (f.modalidad === 'concurso') r.concurso += 1
      if (f.estado === 'completo') r.completos += 1
      if (f.estado === 'observado') r.observados += 1
      if (f.estado === 'sin_iniciar') r.sinIniciar += 1
    }
    return r
  }, [filas])

  if (cargando && seguimientos.length === 0) {
    return <Cargando texto="Buscando los sitios al aire…" />
  }

  const visibles = filtradas.slice(0, MAXIMO_FILAS)
  const proyectosConSitios = proyectos
    .filter((p) => (conteoProyectos.get(p.id) ?? 0) > 0 || p.id === proyectoId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <>
      <CabeceraPantalla
        titulo="Regulatorio"
        descripcion="Cada sitio que sale al aire abre su expediente legal y regulatorio: terreno, DOM, SUBTEL, recepción de obras y, en los obligatorios por concurso, la carpeta de recepción de la localidad."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por proyecto">
            <BotonFiltro
              activo={!proyectoId}
              onClick={() => elegirProyecto(null)}
              nombre="Todos los proyectos"
              total={[...conteoProyectos.values()].reduce((s, n) => s + n, 0)}
            />
            {proyectosConSitios.map((p) => (
              <BotonFiltro
                key={p.id}
                activo={proyectoId === p.id}
                onClick={() => elegirProyecto(p.id)}
                nombre={p.nombre}
                total={conteoProyectos.get(p.id) ?? 0}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Metrica etiqueta="Al aire" valor={resumen.total.toLocaleString('es-CL')} />
            <Metrica etiqueta="De concurso" valor={resumen.concurso.toLocaleString('es-CL')} />
            <Metrica
              etiqueta="Sin iniciar"
              valor={resumen.sinIniciar.toLocaleString('es-CL')}
              tono={resumen.sinIniciar > 0 ? 'riesgo' : 'neutro'}
            />
            <Metrica
              etiqueta="Con observaciones"
              valor={resumen.observados.toLocaleString('es-CL')}
              tono={resumen.observados > 0 ? 'error' : 'neutro'}
            />
            <Metrica
              etiqueta="Expediente completo"
              valor={resumen.completos.toLocaleString('es-CL')}
              tono="ok"
            />
            <div className="ml-auto flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs text-texto-3">
                Tipo de sitio
                <div className="w-52">
                  <Selector
                    value={modalidad}
                    onChange={(e) => setModalidad(e.target.value as '' | Modalidad)}
                  >
                    <option value="">Todos</option>
                    <option value="normal">{NOMBRES_MODALIDAD.normal}</option>
                    <option value="concurso">{NOMBRES_MODALIDAD.concurso}</option>
                  </Selector>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-xs text-texto-3">
                Estado del expediente
                <div className="w-48">
                  <Selector
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                  >
                    <option value="">Todos</option>
                    {Object.entries(NOMBRES_FILTRO_ESTADO).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </Selector>
                </div>
              </label>
            </div>
          </div>
        </div>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {registros.error && (
          <Aviso tono="error" className="mb-3">
            No se pudo leer el avance regulatorio: {registros.error}
          </Aviso>
        )}

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={<Scale aria-hidden className="size-6" />}
            titulo={filas.length === 0 ? 'Todavía no hay sitios al aire' : 'Nada con estos filtros'}
            descripcion={
              filas.length === 0
                ? 'Cuando un sitio cierre su etapa On Air (o su última etapa), aparecerá aquí con su expediente regulatorio.'
                : 'Cambia el tipo de sitio o el estado del expediente.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-texto-3">
                <tr className="border-b border-borde">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Al aire</th>
                  <th className="px-3 py-2 font-medium">Avance</th>
                  <th className="px-3 py-2 font-medium">Carpetas</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.sp.id} className="border-b border-borde align-top last:border-0">
                    <td className="px-3 py-2">
                      <Link
                        to={`/regulatorio/${encodeURIComponent(f.sp.id)}`}
                        className="rounded font-mono text-xs text-[var(--acento)] hover:underline"
                      >
                        {f.sp.sitioId}
                      </Link>
                      <p className="max-w-56 truncate">{f.sp.sitioNombre}</p>
                      <p className="max-w-56 truncate text-xs text-texto-3">
                        {nombreProyecto(f.sp.proyectoId)} · {f.sp.comuna}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Insignia tono={f.modalidad === 'concurso' ? 'acento' : 'neutro'}>
                        {f.modalidad === 'concurso' ? 'Concurso' : 'Normal'}
                      </Insignia>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-texto-2">
                      {f.fecha ? formatearFecha(f.fecha) : 'Sin fecha'}
                      {f.dias !== null && (
                        <p className="text-texto-3 tabular-nums">hace {f.dias} días</p>
                      )}
                    </td>
                    <td className="w-44 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <EstadoExpediente estado={f.estado} />
                        <span className="text-texto-3 tabular-nums">
                          {f.avance.listos}/{f.avance.total}
                        </span>
                      </div>
                      <BarraProgreso
                        valor={f.avance.porcentaje}
                        etiqueta={`${f.avance.porcentaje}% del expediente`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {f.carpetas.map(({ carpeta, avance }) => (
                          <span
                            key={carpeta.id}
                            title={`${carpeta.nombre}: ${avance.listos} de ${avance.total} listos${
                              avance.observados > 0 ? `, ${avance.observados} observados` : ''
                            }`}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                              avance.observados > 0
                                ? 'bg-[var(--error-bg)] text-[var(--error-fg)]'
                                : avance.total > 0 && avance.listos === avance.total
                                  ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]'
                                  : avance.listos + avance.enTramite > 0
                                    ? 'bg-[var(--info-bg)] text-[var(--info-fg)]'
                                    : 'bg-superficie-3 text-texto-3',
                            )}
                          >
                            {carpeta.corto} {avance.listos}/{avance.total}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length > MAXIMO_FILAS && (
              <p className="border-t border-borde px-3 py-2 text-xs text-texto-3">
                Mostrando {MAXIMO_FILAS} de {filtradas.length.toLocaleString('es-CL')}. Elige un
                proyecto para ver el resto.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function EstadoExpediente({ estado }: { estado: Exclude<FiltroEstado, ''> }) {
  const tonos = {
    sin_iniciar: 'riesgo',
    en_curso: 'info',
    observado: 'error',
    completo: 'ok',
  } as const
  return <Insignia tono={tonos[estado]}>{NOMBRES_FILTRO_ESTADO[estado]}</Insignia>
}

function BotonFiltro({
  nombre,
  total,
  activo,
  onClick,
}: {
  nombre: string
  total: number
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
    </button>
  )
}
