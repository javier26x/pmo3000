import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Command, LogOut, Menu, Moon, Radio, Sun, X } from 'lucide-react'
import { Boton, Insignia, cn, iniciales } from '@/components/ui'
import { NOMBRES_ROL } from '@/domain/tipos/comunes'
import { cerrarSesion } from '@/data/autenticacion'
import { avisar, mensajeDeError } from '@/app/avisos'
import { useSesion } from '@/hooks/useSesion'
import { usarTema } from './tema'
import { NAVEGACION } from './navegacion'
import { PaletaComandos } from './PaletaComandos'

export function Layout() {
  const { perfil, puedeHacer } = useSesion()
  const { tema, alternar } = usarTema()
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [paletaAbierta, setPaletaAbierta] = useState(false)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletaAbierta(true)
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  const visibles = NAVEGACION.filter((item) => puedeHacer(item.requiere[0], item.requiere[1]))

  return (
    <div className="flex h-dvh flex-col bg-fondo">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2 focus:shadow-[var(--sombra-flotante)]"
      >
        Saltar al contenido
      </a>

      {/* Barra superior */}
      <header className="flex h-[var(--alto-barra)] shrink-0 items-center gap-2 border-b border-borde bg-superficie px-3">
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          className="md:hidden"
          aria-label={panelAbierto ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto((v) => !v)}
          icono={
            panelAbierto ? (
              <X aria-hidden className="size-4" />
            ) : (
              <Menu aria-hidden className="size-4" />
            )
          }
        />

        <Link to="/sitios" className="flex items-center gap-2 rounded pr-2">
          <Radio aria-hidden className="size-4 text-[var(--acento)]" />
          <span className="font-semibold tracking-tight">PMO3000</span>
          <span className="hidden text-xs text-texto-3 sm:inline">Despliegue de red movil</span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setPaletaAbierta(true)}
          className={cn(
            'hidden h-7 items-center gap-2 rounded border border-borde bg-superficie-2 px-2',
            'text-xs text-texto-3 hover:border-borde-fuerte hover:text-texto-2 sm:flex',
          )}
        >
          <Command aria-hidden className="size-3" />
          Buscar sitio
          <kbd className="rounded bg-superficie-3 px-1 font-mono text-[10px] text-texto-2">
            Ctrl K
          </kbd>
        </button>

        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          onClick={alternar}
          aria-label={tema === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          icono={
            tema === 'claro' ? (
              <Moon aria-hidden className="size-4" />
            ) : (
              <Sun aria-hidden className="size-4" />
            )
          }
        />

        <div className="flex items-center gap-2 border-l border-borde pl-2">
          <div
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-[var(--acento-suave)] text-xs font-semibold text-[var(--acento)]"
          >
            {iniciales(perfil?.nombre ?? '?')}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="max-w-40 truncate text-xs font-medium">{perfil?.nombre}</p>
            <p className="text-[11px] text-texto-3">{perfil ? NOMBRES_ROL[perfil.rol] : ''}</p>
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            aria-label="Cerrar sesion"
            onClick={() => {
              cerrarSesion().catch((e) => avisar.error(mensajeDeError(e)))
            }}
            icono={<LogOut aria-hidden className="size-4" />}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Panel lateral */}
        <nav
          aria-label="Navegacion principal"
          className={cn(
            'w-[var(--ancho-panel)] shrink-0 border-r border-borde bg-superficie p-2',
            'max-md:fixed max-md:inset-y-0 max-md:top-[var(--alto-barra)] max-md:z-40 max-md:shadow-[var(--sombra-flotante)]',
            panelAbierto ? 'max-md:block' : 'max-md:hidden',
          )}
        >
          <ul className="flex flex-col gap-0.5">
            {visibles.map((item) => (
              <li key={item.ruta}>
                <NavLink
                  to={item.ruta}
                  // En celular el panel se cierra al navegar; se hace en el
                  // propio enlace en vez de en un efecto sobre la ubicacion.
                  onClick={() => setPanelAbierto(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-8 items-center gap-2 rounded px-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--acento-suave)] text-[var(--acento)]'
                        : 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
                    )
                  }
                >
                  <item.icono aria-hidden className="size-4 shrink-0" />
                  {item.etiqueta}
                </NavLink>
              </li>
            ))}
          </ul>

          {perfil?.rol === 'contratista' && (
            <div className="mt-3 rounded border border-borde bg-superficie-2 p-2">
              <Insignia tono="info">Vista de proveedor</Insignia>
              <p className="mt-1.5 text-xs text-texto-2">
                Solo ves los sitios asignados a tu empresa.
              </p>
            </div>
          )}

          <p className="mt-4 px-2 text-[11px] leading-relaxed text-texto-3">
            Fase 1: maestro de sitios, gates, kanban y auditoria. Gantt, RAID y reportes llegan en
            la Fase 2.
          </p>
        </nav>

        <main id="contenido" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Se monta solo cuando esta abierta: asi su estado nace limpio y no hay
          que reiniciarlo desde un efecto. */}
      {paletaAbierta && <PaletaComandos onCerrar={() => setPaletaAbierta(false)} />}
    </div>
  )
}
