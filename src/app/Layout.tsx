import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  Command,
  Keyboard,
  LogOut,
  Menu as MenuIcono,
  Moon,
  Radio,
  Rows3,
  Settings2,
  Sun,
  X,
} from 'lucide-react'
import {
  Boton,
  Insignia,
  ItemMenu,
  Menu,
  SeparadorMenu,
  TituloMenu,
  cn,
  iniciales,
} from '@/components/ui'
import { NOMBRES_ROL } from '@/domain/tipos/comunes'
import { cerrarSesion } from '@/features/auth/servicio'
import { avisar, mensajeDeError } from '@/app/avisos'
import { useSesion } from '@/hooks/useSesion'
import { usarTema } from './tema'
import { DENSIDADES, NOMBRES_DENSIDAD, usarDensidad } from './densidad'
import { NAVEGACION } from './navegacion'
import { PaletaComandos } from './PaletaComandos'
import { AyudaAtajos } from './AyudaAtajos'
import { IndicadorConexion } from './IndicadorConexion'
import { useAtajosGlobales } from './atajos'

/** Vistas que comparten los filtros de la URL: al saltar entre ellas se conservan. */
const VISTAS_DESPLIEGUE = new Set(['/sitios', '/mapa', '/kanban'])

export function Layout() {
  const { perfil, puedeHacer } = useSesion()
  const { tema, alternar } = usarTema()
  const densidad = usarDensidad((e) => e.densidad)
  const fijarDensidad = usarDensidad((e) => e.fijar)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [paletaAbierta, setPaletaAbierta] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const ubicacion = useLocation()

  useAtajosGlobales({
    abrirPaleta: () => setPaletaAbierta(true),
    abrirAyuda: () => setAyudaAbierta(true),
  })

  const visibles = NAVEGACION.filter((item) => puedeHacer(item.requiere[0], item.requiere[1]))
  const enVistaDespliegue = VISTAS_DESPLIEGUE.has(ubicacion.pathname)

  return (
    <div className="flex h-dvh flex-col bg-fondo">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:px-3 focus:py-2 focus:shadow-[var(--sombra-flotante)]"
      >
        Saltar al contenido
      </a>

      {/* Barra superior */}
      <header className="vidrio flex h-[var(--alto-barra)] shrink-0 items-center gap-2 border-b border-borde px-3">
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          className="md:hidden"
          aria-label={panelAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto((v) => !v)}
          icono={
            panelAbierto ? (
              <X aria-hidden className="size-4" />
            ) : (
              <MenuIcono aria-hidden className="size-4" />
            )
          }
        />

        <Link to="/sitios" className="flex items-center gap-2 rounded pr-2">
          <Radio aria-hidden className="size-4 text-[var(--acento)]" />
          <span className="font-semibold tracking-tight">PMO3000</span>
          <span className="hidden text-xs text-texto-3 lg:inline">Despliegue de red móvil</span>
        </Link>

        <div className="flex-1" />

        <IndicadorConexion />

        <button
          type="button"
          onClick={() => setPaletaAbierta(true)}
          className={cn(
            'hidden h-7 items-center gap-2 rounded border border-borde bg-superficie-2 px-2',
            'text-xs text-texto-3 transition-colors duration-[var(--ms-instante)]',
            'hover:border-borde-fuerte hover:text-texto-2 sm:flex',
          )}
        >
          <Command aria-hidden className="size-3" />
          Buscar o ejecutar
          <kbd className="tecla">Ctrl K</kbd>
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

        <Menu
          etiqueta=""
          etiquetaAria="Ajustes de la vista y sesión"
          alineacion="derecha"
          ancho="w-56"
          className="size-8 justify-center px-0"
          icono={<Settings2 aria-hidden className="size-4" />}
        >
          {(cerrar) => (
            <>
              <TituloMenu>Densidad de tabla</TituloMenu>
              {DENSIDADES.map((d) => (
                <ItemMenu
                  key={d}
                  onClick={() => {
                    fijarDensidad(d)
                    cerrar()
                  }}
                  activo={densidad === d}
                  icono={<Rows3 aria-hidden className="size-3.5" />}
                >
                  {NOMBRES_DENSIDAD[d]}
                </ItemMenu>
              ))}

              <SeparadorMenu />

              <ItemMenu
                onClick={() => {
                  cerrar()
                  setAyudaAbierta(true)
                }}
                icono={<Keyboard aria-hidden className="size-3.5" />}
                atajo="?"
              >
                Atajos de teclado
              </ItemMenu>

              <SeparadorMenu />

              <ItemMenu
                peligro
                onClick={() => {
                  cerrar()
                  cerrarSesion().catch((e) => avisar.error(mensajeDeError(e)))
                }}
                icono={<LogOut aria-hidden className="size-3.5" />}
              >
                Cerrar sesión
              </ItemMenu>
            </>
          )}
        </Menu>

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
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Panel lateral */}
        <nav
          aria-label="Navegación principal"
          className={cn(
            'vidrio w-[var(--ancho-panel)] shrink-0 border-r border-borde p-2',
            // En movil el panel se abre ENCIMA del contenido: ahi el vidrio deja ver
            // que hay debajo, que es lo que evita la sensacion de cambiar de pantalla.
            'max-md:fixed max-md:inset-y-0 max-md:top-[var(--alto-barra)] max-md:z-40',
            'max-md:shadow-[var(--vidrio-filo),var(--sombra-flotante)]',
            panelAbierto ? 'max-md:block' : 'max-md:hidden',
          )}
        >
          <ul className="flex flex-col gap-0.5">
            {visibles.map((item) => {
              // Saltar de la tabla al mapa o al kanban conserva los filtros: son
              // tres miradas del mismo recorte, no tres pantallas distintas.
              const conservaFiltros = enVistaDespliegue && VISTAS_DESPLIEGUE.has(item.ruta)
              return (
                <li key={item.ruta}>
                  <NavLink
                    to={{
                      pathname: item.ruta,
                      search: conservaFiltros ? ubicacion.search : '',
                    }}
                    viewTransition
                    onClick={() => setPanelAbierto(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2 rounded px-2 text-sm font-medium',
                        'transition-colors duration-[var(--ms-instante)]',
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
              )
            })}
          </ul>

          {perfil?.rol === 'contratista' && (
            <div className="mt-3 rounded border border-borde bg-superficie-2 p-2">
              <Insignia tono="info">Vista de proveedor</Insignia>
              <p className="mt-1.5 text-xs text-texto-2">
                Solo ves los sitios asignados a tu empresa.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            className="mt-4 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-texto-3 hover:bg-superficie-2 hover:text-texto-2"
          >
            <Keyboard aria-hidden className="size-3.5 shrink-0" />
            Atajos de teclado
            <kbd className="tecla ml-auto">?</kbd>
          </button>

          <p className="mt-2 px-2 text-[11px] leading-relaxed text-texto-3">
            Fase 1: maestro de sitios, gates, kanban y auditoría. Gantt, RAID y reportes llegan en
            la Fase 2.
          </p>
        </nav>

        <main
          id="contenido"
          style={{ viewTransitionName: 'contenido' }}
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          <Outlet />
        </main>
      </div>

      {paletaAbierta && <PaletaComandos onCerrar={() => setPaletaAbierta(false)} />}
      <AyudaAtajos abierta={ayudaAbierta} onCerrar={() => setAyudaAbierta(false)} />
    </div>
  )
}
