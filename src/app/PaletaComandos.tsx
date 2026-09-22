import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import {
  ClipboardList,
  CornerDownLeft,
  History,
  House,
  LayoutGrid,
  Map as MapaIcono,
  Moon,
  Rows3,
  Search,
  SlidersHorizontal,
  Sun,
  Upload,
  Users,
} from 'lucide-react'
import { InsigniaGate, cn } from '@/components/ui'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useSesion } from '@/hooks/useSesion'
import { ordenarPorCoincidencia, puntuar } from './coincidencia'
import { usarTema } from './tema'
import { NOMBRES_DENSIDAD, usarDensidad } from './densidad'
import { leerRecientes, recordarSitio } from './sitiosRecientes'
import type { Accion, Recurso } from '@/domain/permisos/matriz'

const TOPE_SITIOS = 8

interface Comando {
  id: string
  titulo: string
  grupo: string
  icono: ReactNode
  atajo?: string
  requiere?: [Recurso, Accion]
  ejecutar: () => void
}

/**
 * Paleta de comandos (⌘K / Ctrl+K).
 *
 * No es solo un buscador de sitios: es la vía rápida a todo lo que la app sabe
 * hacer. El caso que la justifica es real: en una reunión alguien dice un ID de
 * sitio y hay que abrirlo ya, sin filtrar la tabla ni buscar con el mouse.
 */
export function PaletaComandos({ onCerrar }: { onCerrar: () => void }) {
  const { sitios, seguimientos } = useDespliegue()
  const { puedeHacer } = useSesion()
  const navegar = useNavigate()
  const alternarTema = usarTema((e) => e.alternar)
  const tema = usarTema((e) => e.tema)
  const densidad = usarDensidad((e) => e.densidad)
  const siguienteDensidad = usarDensidad((e) => e.siguiente)

  const [texto, setTexto] = useState('')
  const [indice, setIndice] = useState(0)
  const listaRef = useRef<HTMLUListElement>(null)

  const gatePorSitio = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sp of seguimientos) if (!mapa.has(sp.sitioId)) mapa.set(sp.sitioId, sp.gateActual)
    return mapa
  }, [seguimientos])

  const comandos: Comando[] = useMemo(
    () => [
      {
        id: 'ir-inicio',
        titulo: 'Ir al Inicio',
        grupo: 'Navegación',
        icono: <House aria-hidden className="size-4" />,
        atajo: 'G H',
        requiere: ['sitioProyectos', 'ver'],
        ejecutar: () => navegar('/'),
      },
      {
        id: 'ir-sitios',
        titulo: 'Ir a Sitios',
        grupo: 'Navegación',
        icono: <ClipboardList aria-hidden className="size-4" />,
        atajo: 'G S',
        requiere: ['sitios', 'ver'],
        ejecutar: () => navegar('/sitios'),
      },
      {
        id: 'ir-mapa',
        titulo: 'Ir al Mapa',
        grupo: 'Navegación',
        icono: <MapaIcono aria-hidden className="size-4" />,
        atajo: 'G M',
        requiere: ['sitios', 'ver'],
        ejecutar: () => navegar('/mapa'),
      },
      {
        id: 'ir-kanban',
        titulo: 'Ir al Kanban',
        grupo: 'Navegación',
        icono: <LayoutGrid aria-hidden className="size-4" />,
        atajo: 'G K',
        requiere: ['sitioProyectos', 'ver'],
        ejecutar: () => navegar('/kanban'),
      },
      {
        id: 'ir-importar',
        titulo: 'Importar maestro de sitios',
        grupo: 'Navegación',
        icono: <Upload aria-hidden className="size-4" />,
        atajo: 'G I',
        requiere: ['sitios', 'importar'],
        ejecutar: () => navegar('/importar'),
      },
      {
        id: 'ir-auditoria',
        titulo: 'Ver la auditoría',
        grupo: 'Navegación',
        icono: <History aria-hidden className="size-4" />,
        atajo: 'G A',
        requiere: ['auditoria', 'ver'],
        ejecutar: () => navegar('/auditoria'),
      },
      {
        id: 'ir-usuarios',
        titulo: 'Administrar usuarios',
        grupo: 'Navegación',
        icono: <Users aria-hidden className="size-4" />,
        atajo: 'G U',
        requiere: ['usuarios', 'editar'],
        ejecutar: () => navegar('/usuarios'),
      },
      {
        id: 'ir-configuracion',
        titulo: 'Configuración: gates, programas y proyectos',
        grupo: 'Navegación',
        icono: <SlidersHorizontal aria-hidden className="size-4" />,
        requiere: ['gateTemplates', 'editar'],
        ejecutar: () => navegar('/configuracion'),
      },
      {
        id: 'atrasados',
        titulo: 'Ver solo los sitios atrasados',
        grupo: 'Filtros rápidos',
        icono: <Search aria-hidden className="size-4" />,
        requiere: ['sitioProyectos', 'ver'],
        ejecutar: () => navegar('/sitios?atr=1'),
      },
      {
        id: 'bloqueados',
        titulo: 'Ver solo los sitios bloqueados',
        grupo: 'Filtros rápidos',
        icono: <Search aria-hidden className="size-4" />,
        requiere: ['sitioProyectos', 'ver'],
        ejecutar: () => navegar('/sitios?blo=1'),
      },
      {
        id: 'tema',
        titulo: tema === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro',
        grupo: 'Apariencia',
        icono:
          tema === 'claro' ? (
            <Moon aria-hidden className="size-4" />
          ) : (
            <Sun aria-hidden className="size-4" />
          ),
        atajo: 'T',
        ejecutar: alternarTema,
      },
      {
        id: 'densidad',
        titulo: `Densidad de tabla: ${NOMBRES_DENSIDAD[densidad]}`,
        grupo: 'Apariencia',
        icono: <Rows3 aria-hidden className="size-4" />,
        atajo: 'D',
        ejecutar: siguienteDensidad,
      },
    ],
    [navegar, alternarTema, tema, densidad, siguienteDensidad],
  )

  const comandosVisibles = useMemo(
    () =>
      comandos
        .filter((c) => !c.requiere || puedeHacer(c.requiere[0], c.requiere[1]))
        .filter((c) => texto.trim() === '' || puntuar(c.titulo, texto) !== null)
        .sort((a, b) => (puntuar(b.titulo, texto) ?? 0) - (puntuar(a.titulo, texto) ?? 0)),
    [comandos, puedeHacer, texto],
  )

  const sitiosVisibles = useMemo(() => {
    if (texto.trim() === '') {
      const recientes = leerRecientes()
      return recientes
        .map((id) => sitios.find((s) => s.id === id))
        .filter((s): s is (typeof sitios)[number] => Boolean(s))
    }
    return ordenarPorCoincidencia(sitios, texto, (s) => [s.id, s.nombre, s.comuna], TOPE_SITIOS)
  }, [sitios, texto])

  const pareceId = /^[A-Za-z]{2,5}-?\d{1,6}$/.test(texto.trim())

  const grupos = useMemo(() => {
    const salida: {
      titulo: string
      items: { clave: string; render: ReactNode; ejecutar: () => void }[]
    }[] = []

    if (sitiosVisibles.length > 0) {
      salida.push({
        titulo: texto.trim() === '' ? 'Sitios recientes' : 'Sitios',
        items: sitiosVisibles.map((sitio) => ({
          clave: `sitio-${sitio.id}`,
          ejecutar: () => {
            recordarSitio(sitio.id)
            navegar(`/sitios/${encodeURIComponent(sitio.id)}`)
          },
          render: (
            <>
              <span className="w-24 shrink-0 truncate font-mono text-xs text-texto-2">
                {sitio.id}
              </span>
              <span className="min-w-0 flex-1 truncate">{sitio.nombre}</span>
              <span className="hidden shrink-0 text-xs text-texto-3 sm:inline">{sitio.comuna}</span>
              {gatePorSitio.has(sitio.id) && (
                <InsigniaGate gate={gatePorSitio.get(sitio.id) as never} />
              )}
            </>
          ),
        })),
      })
    }

    if (sitiosVisibles.length === 0 && pareceId) {
      const id = texto.trim().toUpperCase()
      salida.push({
        titulo: 'Maestro de sitios',
        items: [
          {
            clave: `abrir-${id}`,
            ejecutar: () => navegar(`/sitios/${encodeURIComponent(id)}`),
            render: (
              <>
                <span className="shrink-0 text-texto-3">
                  <Search aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  Abrir el sitio <span className="font-mono">{id}</span> del maestro
                </span>
              </>
            ),
          },
        ],
      })
    }

    for (const grupo of ['Navegación', 'Filtros rápidos', 'Apariencia']) {
      const items = comandosVisibles.filter((c) => c.grupo === grupo)
      if (items.length === 0) continue
      salida.push({
        titulo: grupo,
        items: items.map((c) => ({
          clave: c.id,
          ejecutar: c.ejecutar,
          render: (
            <>
              <span className="shrink-0 text-texto-3">{c.icono}</span>
              <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
              {c.atajo && <span className="tecla shrink-0">{c.atajo}</span>}
            </>
          ),
        })),
      })
    }

    return salida
  }, [sitiosVisibles, comandosVisibles, texto, navegar, gatePorSitio, pareceId])

  const planos = useMemo(() => grupos.flatMap((g) => g.items), [grupos])

  // Si la lista se acorto, el cursor se acota en el render en vez de corregirse
  // en un efecto: asi nunca hay un pintado apuntando a un resultado inexistente.
  const cursor = indice < planos.length ? indice : 0

  useEffect(() => {
    listaRef.current
      ?.querySelector(`[data-indice="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const ejecutar = (i: number) => {
    const elegido = planos[i]
    if (!elegido) return
    onCerrar()
    elegido.ejecutar()
  }

  let contador = -1

  return (
    <div
      className="vidrio-velo fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Paleta de comandos"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="anim-aparecer vidrio-denso vidrio-alzado w-full max-w-xl overflow-hidden rounded-xl border"
      >
        <div className="flex items-center gap-2 border-b border-borde px-3">
          <Search aria-hidden className="size-4 shrink-0 text-texto-3" />
          <input
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
                setIndice((cursor + 1) % Math.max(planos.length, 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndice((cursor - 1 + planos.length) % Math.max(planos.length, 1))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                ejecutar(cursor)
              }
            }}
            placeholder="Buscar un sitio o ejecutar una acción…"
            aria-label="Buscar un sitio o ejecutar una acción"
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-texto-3"
          />
          <kbd className="tecla shrink-0">Esc</kbd>
        </div>

        <ul ref={listaRef} className="panel-scroll max-h-[50vh] overflow-y-auto py-1">
          {planos.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-texto-2">
              Nada coincide con «{texto}».
            </li>
          )}

          {grupos.map((grupo) => (
            <li key={grupo.titulo}>
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-texto-3 uppercase">
                {grupo.titulo}
              </p>
              <ul>
                {grupo.items.map((item) => {
                  contador += 1
                  const i = contador
                  return (
                    <li key={item.clave}>
                      <button
                        type="button"
                        data-indice={i}
                        onMouseMove={() => setIndice(i)}
                        onClick={() => ejecutar(i)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                          'transition-colors duration-[var(--ms-instante)]',
                          i === cursor ? 'bg-[var(--acento-suave)]' : 'hover:bg-superficie-2',
                        )}
                      >
                        {item.render}
                        {i === cursor && (
                          <CornerDownLeft aria-hidden className="size-3 shrink-0 text-texto-3" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-borde bg-[var(--vidrio-sutil)] px-3 py-1.5 text-[11px] text-texto-3">
          <span className="flex items-center gap-1">
            <kbd className="tecla">↑</kbd>
            <kbd className="tecla">↓</kbd> moverse
          </span>
          <span className="flex items-center gap-1">
            <kbd className="tecla">↵</kbd> abrir
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="tecla">?</kbd> atajos
          </span>
        </div>
      </div>
    </div>
  )
}
