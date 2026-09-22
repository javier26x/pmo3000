import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { CornerDownLeft, Search } from 'lucide-react'
import { InsigniaGate, cn } from '@/components/ui'
import { useDespliegue } from '@/hooks/useDespliegue'
import { filtrarSitios } from '@/domain/vistas/filtrado'

const MAXIMO = 12

/**
 * Paleta de comandos (Ctrl/Cmd+K). El caso de uso real: alguien en una reunion
 * dice un ID de sitio y hay que abrirlo ya, sin filtrar la tabla.
 */
export function PaletaComandos({ onCerrar }: { onCerrar: () => void }) {
  const { sitios, seguimientos } = useDespliegue()
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [indice, setIndice] = useState(0)

  const gatePorSitio = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sp of seguimientos) if (!mapa.has(sp.sitioId)) mapa.set(sp.sitioId, sp.gateActual)
    return mapa
  }, [seguimientos])

  const resultados = useMemo(() => {
    if (texto.trim() === '') return sitios.slice(0, MAXIMO)
    return filtrarSitios(sitios, { texto, region: null, comuna: null }).slice(0, MAXIMO)
  }, [sitios, texto])

  const abrir = (sitioId: string) => {
    onCerrar()
    navegar(`/sitios/${encodeURIComponent(sitioId)}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Buscar sitio"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-borde bg-superficie shadow-[var(--sombra-flotante)]"
      >
        <div className="flex items-center gap-2 border-b border-borde px-3">
          <Search aria-hidden className="size-4 shrink-0 text-texto-3" />
          <input
            // La paleta se abre para escribir: el foco parte en el campo.
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setIndice(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCerrar()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndice((i) => Math.min(i + 1, resultados.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndice((i) => Math.max(i - 1, 0))
              }
              if (e.key === 'Enter') {
                const elegido = resultados[indice]
                if (elegido) abrir(elegido.id)
              }
            }}
            placeholder="Buscar por ID, nombre o comuna…"
            aria-label="Buscar sitio por ID, nombre o comuna"
            className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-texto-3"
          />
          <kbd className="rounded bg-superficie-3 px-1.5 py-0.5 font-mono text-[10px] text-texto-2">
            Esc
          </kbd>
        </div>

        <ul className="panel-scroll max-h-80 overflow-y-auto py-1">
          {resultados.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-texto-2">
              Ningun sitio coincide con “{texto}”.
            </li>
          )}
          {resultados.map((sitio, i) => {
            const gate = gatePorSitio.get(sitio.id)
            return (
              <li key={sitio.id}>
                <button
                  type="button"
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => abrir(sitio.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    i === indice ? 'bg-superficie-2' : 'hover:bg-superficie-2',
                  )}
                >
                  <span className="w-28 shrink-0 truncate font-mono text-xs text-texto-2">
                    {sitio.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{sitio.nombre}</span>
                  <span className="hidden shrink-0 text-xs text-texto-3 sm:inline">
                    {sitio.comuna}
                  </span>
                  {gate && <InsigniaGate gate={gate as never} />}
                  {i === indice && (
                    <CornerDownLeft aria-hidden className="size-3 shrink-0 text-texto-3" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
