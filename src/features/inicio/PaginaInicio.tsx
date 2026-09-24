import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Clock, Lock } from 'lucide-react'
import { InsigniaGate, cn } from '@/components/ui'
import { leerRecientes } from '@/app/sitiosRecientes'
import { ZONA_HORARIA, formatearFecha } from '@/domain/fechas'
import { textoAtraso } from '@/domain/gates/atraso'
import { CERRADO, type GateActual } from '@/domain/gates/catalogo'
import { pideAccion } from '@/domain/tracker/estados'
import { atrasoDeSeguimiento, semaforoDeSeguimiento } from '@/domain/vistas/filtrado'
import { ritmoSemanal } from '@/domain/vistas/ritmo'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useMedidorSla, type MedidorSla } from '@/hooks/useSla'
import { usePendientes } from '@/hooks/usePendientes'
import { useSesion } from '@/hooks/useSesion'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { GraficoRitmo } from './GraficoRitmo'
import { GraficoTrabas, type FilaTraba } from './GraficoTrabas'
import { Cifra, Franja, numero, type Tramo } from './piezas'

const horaChile = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA_HORARIA,
  hour: 'numeric',
  hour12: false,
})
const fechaLarga = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA_HORARIA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function saludo(): string {
  const hora = Number(horaChile.format(new Date()))
  if (hora < 12) return 'Buenos días'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

interface Resumen {
  total: number
  atrasados: number
  porVencer: number
  bloqueados: number
  alAire: number
  /** Llevan en su etapa mas dias que el SLA de su proyecto. */
  fueraSla: number
  porGate: Map<GateActual, number>
  atrasadosPorGate: Map<GateActual, number>
  /** Lo que hay que mirar hoy: atrasados primero, luego lo que vence pronto. */
  urgentes: { sp: SitioProyecto; dias: number }[]
}

function resumir(lista: readonly SitioProyecto[], hoy: string, medirSla: MedidorSla): Resumen {
  const porGate = new Map<GateActual, number>()
  const atrasadosPorGate = new Map<GateActual, number>()
  const urgentes: Resumen['urgentes'] = []
  let atrasados = 0
  let porVencer = 0
  let bloqueados = 0
  let alAire = 0
  let fueraSla = 0

  let total = 0
  for (const sp of lista) {
    // Igual que la tabla por defecto: un sitio fuera de plan no cuenta. Si no,
    // cada cifra prometeria mas filas de las que muestra su enlace.
    if (sp.vigente === false) continue
    total += 1
    porGate.set(sp.gateActual, (porGate.get(sp.gateActual) ?? 0) + 1)
    if (sp.bloqueado) bloqueados += 1
    if (medirSla(sp, hoy).estado === 'vencido') fueraSla += 1
    if (sp.gateActual === CERRADO) {
      alAire += 1
      continue
    }
    const estado = semaforoDeSeguimiento(sp, hoy)
    if (estado === 'atrasado' || estado === 'por_vencer') {
      if (estado === 'atrasado') {
        atrasados += 1
        atrasadosPorGate.set(sp.gateActual, (atrasadosPorGate.get(sp.gateActual) ?? 0) + 1)
      } else porVencer += 1
      urgentes.push({ sp, dias: atrasoDeSeguimiento(sp, hoy) ?? 0 })
    }
  }

  urgentes.sort((a, b) => b.dias - a.dias)
  return {
    total,
    atrasados,
    porVencer,
    bloqueados,
    alAire,
    fueraSla,
    porGate,
    atrasadosPorGate,
    urgentes: urgentes.slice(0, 7),
  }
}

/**
 * Inicio: lo primero que ve la PMO cada mañana. Responde tres preguntas, en
 * este orden: ¿cuanto llevamos al aire?, ¿a que ritmo vamos? y ¿donde esta
 * trabado? Cada cifra y cada barra es un enlace a la lista ya filtrada, asi
 * que el resumen nunca es un callejon sin salida.
 */
export function PaginaInicio() {
  useTituloPagina('Inicio')
  const { perfil } = useSesion()
  const { seguimientos, cargando, completando, hoy } = useDespliegue()
  const { etapas, proyectos } = useCatalogos()

  const medirSla = useMedidorSla()
  const { pendientes, hayAreas } = usePendientes()
  const misPendientes = pendientes.filter((p) => perfil && p.responsables.includes(perfil.id))
  const conSla = proyectos.some((p) => p.sla !== null)
  const r = useMemo(() => resumir(seguimientos, hoy, medirSla), [seguimientos, hoy, medirSla])
  const ritmo = useMemo(() => ritmoSemanal(seguimientos, hoy, 12), [seguimientos, hoy])

  // Donde se traba: con areas configuradas, las revisiones que esperan a cada
  // una; sin ellas, los sitios atrasados en cada etapa.
  const trabas = useMemo<FilaTraba[]>(() => {
    if (hayAreas) {
      const porArea = new Map<string, FilaTraba>()
      for (const p of pendientes) {
        const fila = porArea.get(p.area.id) ?? {
          id: p.area.id,
          etiqueta: p.area.nombre,
          total: 0,
          destacado: 0,
          a: '/pendientes',
        }
        fila.total += 1
        if (pideAccion(p.estado)) fila.destacado += 1
        porArea.set(p.area.id, fila)
      }
      return [...porArea.values()].sort((a, b) => b.total - a.total)
    }
    return etapas
      .map((e) => ({
        id: e.codigo,
        etiqueta: e.nombre,
        total: r.porGate.get(e.codigo) ?? 0,
        destacado: r.atrasadosPorGate.get(e.codigo) ?? 0,
        a: `/sitios?gate=${encodeURIComponent(e.codigo)}`,
      }))
      .filter((f) => f.total > 0)
      .sort((a, b) => b.destacado - a.destacado || b.total - a.total)
      .slice(0, 6)
  }, [hayAreas, pendientes, etapas, r])

  const recientes = useMemo(() => {
    const porSitio = new Map<string, SitioProyecto>()
    for (const sp of seguimientos) if (!porSitio.has(sp.sitioId)) porSitio.set(sp.sitioId, sp)
    return leerRecientes()
      .map((id) => porSitio.get(id))
      .filter((sp): sp is SitioProyecto => sp !== undefined)
      .slice(0, 5)
  }, [seguimientos])

  const tramos: Tramo[] = [...etapas.map((e) => e.codigo), CERRADO]
    .map((gate) => ({
      gate,
      total: r.porGate.get(gate) ?? 0,
      a: `/sitios?gate=${encodeURIComponent(gate)}`,
    }))
    .filter((t) => t.total > 0)

  const primerNombre = perfil?.nombre.split(' ')[0] ?? ''
  const sinDatos = !cargando && r.total === 0
  const porcentaje = r.total === 0 ? 0 : Math.round((r.alAire / r.total) * 100)

  return (
    <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs text-texto-3 first-letter:uppercase">
              {fechaLarga.format(new Date())}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {saludo()}
              {primerNombre ? `, ${primerNombre}` : ''}
            </h1>
          </div>
          {misPendientes.length > 0 && (
            <Link
              to="/pendientes"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--acento-borde)] bg-[var(--acento-suave)] px-4 text-sm font-medium text-[var(--acento)] hover:border-[var(--acento)]"
            >
              Tienes {numero(misPendientes.length)} revisiones pendientes
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </header>

        {/* Tesis de la pantalla: cuanto del plan ya esta al aire, y donde esta
            el resto. La franja es el proceso real, en el orden de sus etapas. */}
        <section
          aria-labelledby="titulo-franja"
          className="lente rounded-[var(--radio-lente)] p-5 sm:p-6"
        >
          {cargando ? (
            <div className="flex flex-col gap-3" aria-busy>
              <span className="esqueleto h-7 w-72 max-w-full rounded" />
              <span className="esqueleto h-11 w-full rounded-full" />
            </div>
          ) : sinDatos ? (
            <p className="text-sm text-texto-2">
              Todavía no hay sitios en seguimiento. Importa un tracker para empezar.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                <h2 id="titulo-franja" className="text-2xl font-semibold tracking-tight">
                  <span className="text-[var(--acento)] tabular-nums">{numero(r.alAire)}</span> de{' '}
                  <span className="tabular-nums">{numero(r.total)}</span> sitios ya están al aire
                </h2>
                <p className="text-sm text-texto-2">
                  <span className="font-semibold text-texto tabular-nums">{porcentaje}%</span> del
                  plan · {numero(r.total - r.alAire)} en camino
                  {completando && <span className="text-texto-3"> · cargando el resto…</span>}
                </p>
              </div>

              <div className="mt-4">
                <Franja tramos={tramos} etapas={etapas} />
              </div>
            </>
          )}
        </section>

        {/* Salud del plan: cada cifra abre la tabla con ese recorte. */}
        <section
          aria-label="Salud del plan"
          className={cn(
            'grid grid-cols-2 gap-px overflow-hidden rounded-2xl lente',
            conSla ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
          )}
        >
          <Cifra
            etiqueta="Atrasados"
            valor={r.atrasados}
            tono="error"
            a="/sitios?atr=1"
            cargando={cargando}
          />
          <Cifra
            etiqueta="Vencen en 3 días"
            valor={r.porVencer}
            tono="riesgo"
            a="/sitios?ord=plan:asc"
            cargando={cargando}
          />
          <Cifra etiqueta="Bloqueados" valor={r.bloqueados} a="/sitios?blo=1" cargando={cargando} />
          {conSla && (
            <Cifra
              etiqueta="Fuera de SLA"
              valor={r.fueraSla}
              tono="error"
              a="/sitios?sla=1"
              cargando={cargando}
            />
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="hoja-inicio rounded-[var(--radio-lente)] border border-[var(--vidrio-divisor)] p-5">
            <GraficoRitmo semanas={ritmo} />
          </div>
          <div className="hoja-inicio rounded-[var(--radio-lente)] border border-[var(--vidrio-divisor)] p-5">
            <GraficoTrabas
              titulo="Dónde se traba"
              subtitulo={
                hayAreas
                  ? 'Revisiones pendientes por área'
                  : 'Sitios por etapa, con los atrasados en rojo'
              }
              filas={trabas}
              leyendaTotal={hayAreas ? 'Pendientes' : 'Sitios en la etapa'}
              leyendaDestacado={hayAreas ? 'Observados o rechazados' : 'Atrasados'}
              vacio={hayAreas ? 'Ninguna revisión pendiente.' : 'Nada atrasado. El plan va al día.'}
            />
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[1.6fr_1fr]">
          <section aria-labelledby="titulo-urgentes">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="titulo-urgentes" className="text-sm font-semibold">
                Para mirar hoy
              </h2>
              {r.urgentes.length > 0 && (
                <Link to="/sitios?atr=1" className="enlace-sutil text-xs">
                  Ver todos
                </Link>
              )}
            </div>
            {r.urgentes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-texto-3">
                {cargando ? 'Revisando compromisos…' : 'Nada atrasado ni por vencer. Buen día.'}
              </p>
            ) : (
              <ul className="divide-y divide-borde">
                {r.urgentes.map(({ sp, dias }) => (
                  <li key={sp.id}>
                    <Link
                      to={`/seguimiento/${encodeURIComponent(sp.id)}`}
                      className="fila-inicio group flex min-h-11 items-center gap-3 py-2"
                    >
                      <span className="w-16 shrink-0 font-mono text-xs text-texto-3">
                        {sp.sitioId}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{sp.sitioNombre}</span>
                      <InsigniaGate gate={sp.gateActual} estado={sp.estadoGate} />
                      <span
                        className={cn(
                          'w-24 shrink-0 text-right text-xs tabular-nums',
                          dias > 0 ? 'text-[var(--error-fg)]' : 'text-[var(--riesgo-fg)]',
                        )}
                      >
                        {textoAtraso(dias)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-recientes">
            <h2 id="titulo-recientes" className="mb-2 text-sm font-semibold">
              Abiertos hace poco
            </h2>
            {recientes.length === 0 ? (
              <p className="text-sm text-texto-3">
                Los sitios que abras aparecen aquí. Para ir a uno directo, usa{' '}
                <kbd className="tecla">Ctrl K</kbd>.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recientes.map((sp) => (
                  <li key={sp.id}>
                    <Link
                      to={`/seguimiento/${encodeURIComponent(sp.id)}`}
                      className="fila-inicio flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5"
                    >
                      <Clock aria-hidden className="size-3.5 shrink-0 text-texto-3" />
                      <span className="min-w-0 flex-1 truncate text-sm">{sp.sitioNombre}</span>
                      {sp.bloqueado && (
                        <Lock aria-label="Bloqueado" className="size-3.5 text-[var(--riesgo-fg)]" />
                      )}
                      <span className="text-xs text-texto-3">
                        {formatearFecha(sp.fechaPlanGateActual)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
