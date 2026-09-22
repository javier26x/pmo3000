import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Clock, Lock } from 'lucide-react'
import { InsigniaGate, cn } from '@/components/ui'
import { leerRecientes } from '@/app/PaletaComandos'
import { ZONA_HORARIA, formatearFecha } from '@/domain/fechas'
import { semaforo, textoAtraso } from '@/domain/gates/atraso'
import { CERRADO, claseGate, nombreGate, type GateActual } from '@/domain/gates/catalogo'
import { atrasoDeSeguimiento } from '@/domain/vistas/filtrado'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useMedidorSla, type MedidorSla } from '@/hooks/useSla'
import { usePendientes } from '@/hooks/usePendientes'
import { useSesion } from '@/hooks/useSesion'
import { useTituloPagina } from '@/hooks/useTituloPagina'

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

const numero = (n: number) => n.toLocaleString('es-CL')

interface Resumen {
  total: number
  atrasados: number
  porVencer: number
  bloqueados: number
  cerrados: number
  /** Llevan en su etapa mas dias que el SLA de su proyecto. */
  fueraSla: number
  porGate: Map<GateActual, number>
  /** Lo que hay que mirar hoy: atrasados primero, luego lo que vence pronto. */
  urgentes: { sp: SitioProyecto; dias: number }[]
}

function resumir(lista: readonly SitioProyecto[], hoy: string, medirSla: MedidorSla): Resumen {
  const porGate = new Map<GateActual, number>()
  const urgentes: Resumen['urgentes'] = []
  let atrasados = 0
  let porVencer = 0
  let bloqueados = 0
  let cerrados = 0
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
      cerrados += 1
      continue
    }
    const gate = sp.gates[sp.gateActual]
    const estado = semaforo(gate?.fechaPlan ?? null, gate?.fechaReal ?? null, hoy)
    if (estado === 'atrasado' || estado === 'por_vencer') {
      if (estado === 'atrasado') atrasados += 1
      else porVencer += 1
      urgentes.push({ sp, dias: atrasoDeSeguimiento(sp, hoy) ?? 0 })
    }
  }

  urgentes.sort((a, b) => b.dias - a.dias)
  return {
    total,
    atrasados,
    porVencer,
    bloqueados,
    cerrados,
    fueraSla,
    porGate,
    urgentes: urgentes.slice(0, 7),
  }
}

/**
 * Inicio: la primera pregunta de cada mañana es «¿qué se atrasó y dónde se está
 * atascando?». La pantalla responde eso y nada más; cada cifra es un enlace a la
 * tabla ya filtrada, así que el resumen nunca es un callejón sin salida.
 */
export function PaginaInicio() {
  useTituloPagina('Inicio')
  const { perfil } = useSesion()
  const { seguimientos, cargando, completando, hoy } = useDespliegue()
  const { etapas, proyectos } = useCatalogos()

  const medirSla = useMedidorSla()
  const { pendientes } = usePendientes()
  const misPendientes = pendientes.filter((p) => perfil && p.responsables.includes(perfil.id))
  const conSla = proyectos.some((p) => p.sla !== null)
  const r = useMemo(() => resumir(seguimientos, hoy, medirSla), [seguimientos, hoy, medirSla])

  const recientes = useMemo(() => {
    const porSitio = new Map<string, SitioProyecto>()
    for (const sp of seguimientos) if (!porSitio.has(sp.sitioId)) porSitio.set(sp.sitioId, sp)
    return leerRecientes()
      .map((id) => porSitio.get(id))
      .filter((sp): sp is SitioProyecto => sp !== undefined)
      .slice(0, 5)
  }, [seguimientos])

  const tramos = [...etapas.map((e) => e.codigo), CERRADO]
    .map((gate) => ({ gate, total: r.porGate.get(gate) ?? 0 }))
    .filter((t) => t.total > 0)

  const primerNombre = perfil?.nombre.split(' ')[0] ?? ''
  const sinDatos = !cargando && r.total === 0

  return (
    <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        <header>
          <p className="text-xs text-texto-3 first-letter:uppercase">
            {fechaLarga.format(new Date())}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {saludo()}
            {primerNombre ? `, ${primerNombre}` : ''}
          </h1>
          <p className="mt-1 text-sm text-texto-2">
            {cargando ? (
              'Trayendo el estado del despliegue…'
            ) : sinDatos ? (
              'Todavía no hay sitios en seguimiento.'
            ) : (
              <>
                {numero(r.total)} sitios en seguimiento
                {completando && <span className="text-texto-3"> · cargando el resto…</span>}
              </>
            )}
          </p>
          {misPendientes.length > 0 && (
            <Link
              to="/pendientes"
              className="mt-2 inline-flex items-center gap-1 rounded text-sm text-[var(--acento)] hover:underline"
            >
              Tienes {numero(misPendientes.length)} revisiones pendientes
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </header>

        {/* Cifras: cada una abre la tabla con ese recorte. */}
        <section
          aria-label="Resumen"
          className={cn(
            'grid grid-cols-2 gap-px overflow-hidden rounded-2xl lente',
            conSla ? 'sm:grid-cols-5' : 'sm:grid-cols-4',
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
          <Cifra
            etiqueta="Cerrados"
            valor={r.cerrados}
            tono="ok"
            a={`/sitios?gate=${CERRADO}`}
            cargando={cargando}
          />
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

        {/* Firma: la franja del despliegue. El ancho de cada tramo es su peso. */}
        {tramos.length > 0 && (
          <section aria-labelledby="titulo-franja">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="titulo-franja" className="text-xs font-semibold text-texto-2">
                Dónde están los sitios
              </h2>
              <Link to="/kanban" className="enlace-sutil text-xs">
                Ver kanban
              </Link>
            </div>
            <div className="franja lente flex h-11 gap-0.5 overflow-hidden rounded-full p-1">
              {tramos.map((t) => (
                <Link
                  key={t.gate}
                  to={`/sitios?gate=${encodeURIComponent(t.gate)}`}
                  title={`${nombreGate(t.gate, etapas)}: ${numero(t.total)}`}
                  aria-label={`${nombreGate(t.gate, etapas)}: ${numero(t.total)} sitios`}
                  style={{ flexGrow: t.total }}
                  className={cn(
                    claseGate(t.gate, etapas),
                    'tramo-franja min-w-2 basis-0 rounded-full',
                  )}
                />
              ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {tramos.map((t) => (
                <li
                  key={t.gate}
                  className={cn(claseGate(t.gate, etapas), 'flex items-center gap-1.5')}
                >
                  <span aria-hidden className="punto-gate size-2 rounded-full" />
                  <span className="text-texto-2">{nombreGate(t.gate, etapas)}</span>
                  <span className="font-medium tabular-nums">{numero(t.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-8 md:grid-cols-[1.6fr_1fr]">
          <section aria-labelledby="titulo-urgentes">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="titulo-urgentes" className="text-xs font-semibold text-texto-2">
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
                      className="fila-inicio group flex items-center gap-3 py-2.5"
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
            <h2 id="titulo-recientes" className="mb-2 text-xs font-semibold text-texto-2">
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
                      className="fila-inicio flex items-center gap-2 rounded-lg px-2 py-1.5"
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

function Cifra({
  etiqueta,
  valor,
  tono,
  a,
  cargando,
}: {
  etiqueta: string
  valor: number
  tono?: 'error' | 'riesgo' | 'ok'
  a: string
  cargando: boolean
}) {
  const color = {
    error: 'text-[var(--error-fg)]',
    riesgo: 'text-[var(--riesgo-fg)]',
    ok: 'text-[var(--ok-fg)]',
  }
  return (
    <Link to={a} className="cifra-inicio group flex min-h-24 flex-col justify-between gap-3 p-4">
      <span className="flex items-center justify-between text-xs text-texto-2">
        {etiqueta}
        <ArrowRight
          aria-hidden
          className="size-3.5 -translate-x-1 opacity-0 transition-all duration-[var(--ms-rapido)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>
      {cargando ? (
        <span aria-hidden className="esqueleto h-7 w-12 rounded" />
      ) : (
        <span
          className={cn(
            'text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums',
            valor > 0 && tono ? color[tono] : 'text-texto',
          )}
        >
          {numero(valor)}
        </span>
      )}
    </Link>
  )
}
