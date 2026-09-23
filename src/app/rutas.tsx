import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Cargando, EstadoVacio } from '@/components/ui'
import { PaginaLogin } from '@/features/auth/PaginaLogin'
import { RutaProtegida } from '@/features/auth/RutaProtegida'
import { ProveedorCatalogos } from '@/hooks/useCatalogos'
import { ProveedorDespliegue } from '@/hooks/useDespliegue'
import { Layout } from './Layout'

// El mapa (Leaflet) y el importador (SheetJS) son los modulos pesados: se
// cargan solo cuando alguien entra a esas pantallas. Kanban (dnd-kit) y las
// pantallas de administracion tambien: casi nadie las abre al entrar, y sacarlas
// del trozo inicial acorta el primer pintado del Inicio.
const cargarMapa = () => import('@/features/sitios/PaginaMapa')
const cargarImportar = () => import('@/features/importacion/PaginaImportar')
const cargarTracker = () => import('@/features/tracker/PaginaImportarTracker')
const cargarKanban = () => import('@/features/kanban/PaginaKanban')
const cargarAuditoria = () => import('@/features/auditoria/PaginaAuditoria')
const cargarUsuarios = () => import('@/features/admin/PaginaUsuarios')
const cargarConfiguracion = () => import('@/features/admin/PaginaConfiguracion')
const cargarProyectos = () => import('@/features/proyectos/PaginaProyectos')
const cargarProyecto = () => import('@/features/proyectos/PaginaProyecto')
// La ficha del sitio y la del seguimiento son las dos pantallas mas pesadas que
// quedaban en el trozo inicial (la del seguimiento arrastra la maquina de gates,
// el checklist, las revisiones y el historial). Se llega a ellas con un clic
// desde la tabla, asi que el precargador las tiene listas antes de ese clic.
const cargarSitio = () => import('@/features/sitios/PaginaSitio')
const cargarSeguimiento = () => import('@/features/gates/PaginaSeguimiento')
const cargarPaleta = () => import('./PaletaComandos')
const cargarAyuda = () => import('./AyudaAtajos')

const PaginaMapa = lazy(cargarMapa)
const PaginaImportar = lazy(cargarImportar)
const PaginaImportarTracker = lazy(cargarTracker)
const PaginaKanban = lazy(() => cargarKanban().then((m) => ({ default: m.PaginaKanban })))
const PaginaAuditoria = lazy(() => cargarAuditoria().then((m) => ({ default: m.PaginaAuditoria })))
const PaginaUsuarios = lazy(() => cargarUsuarios().then((m) => ({ default: m.PaginaUsuarios })))
const PaginaConfiguracion = lazy(() =>
  cargarConfiguracion().then((m) => ({ default: m.PaginaConfiguracion })),
)
const PaginaProyectos = lazy(() =>
  cargarProyectos().then((m) => ({ default: m.PaginaProyectos })),
)
const PaginaProyecto = lazy(() => cargarProyecto().then((m) => ({ default: m.PaginaProyecto })))
const PaginaSitio = lazy(() => cargarSitio().then((m) => ({ default: m.PaginaSitio })))
const PaginaSeguimiento = lazy(() =>
  cargarSeguimiento().then((m) => ({ default: m.PaginaSeguimiento })),
)

/**
 * Precarga en segundo plano, cuando el navegador queda libre despues del primer
 * pintado. Asi el trozo inicial es chico y, aun asi, saltar al kanban o al mapa
 * no espera la red: el modulo ya esta en cache cuando alguien hace clic.
 */
function precargarPantallas(): void {
  // En orden de probabilidad: del maestro se entra a una ficha mucho antes que
  // al importador.
  const cargas = [
    cargarSeguimiento,
    cargarSitio,
    cargarKanban,
    cargarPaleta,
    cargarMapa,
    cargarAyuda,
    cargarConfiguracion,
    cargarProyectos,
    cargarUsuarios,
    cargarAuditoria,
    cargarTracker,
    cargarImportar,
  ]
  const siguiente = () => {
    const carga = cargas.shift()
    if (!carga) return
    carga()
      .catch(() => {
        // Sin red la precarga falla en silencio: la pantalla se pedira al abrirla.
      })
      .finally(() => programar(siguiente))
  }
  const programar = (fn: () => void) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 4000 })
    } else {
      setTimeout(fn, 400)
    }
  }
  // Un respiro antes de empezar: la carga del seguimiento compite por el hilo.
  window.setTimeout(() => programar(siguiente), 3000)
}

if (typeof window !== 'undefined') precargarPantallas()

import { PaginaInicio } from '@/features/inicio/PaginaInicio'
import { PaginaSitios } from '@/features/sitios/PaginaSitios'
import { PaginaPendientes } from '@/features/pendientes/PaginaPendientes'

/** Envuelve las rutas de la app con los proveedores de datos compartidos. */
function AppProtegida() {
  return (
    <RutaProtegida>
      <ProveedorCatalogos>
        <ProveedorDespliegue>
          <Layout />
        </ProveedorDespliegue>
      </ProveedorCatalogos>
    </RutaProtegida>
  )
}

export function Rutas() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PaginaLogin />} />

        <Route element={<AppProtegida />}>
          <Route index element={<PaginaInicio />} />
          <Route path="/sitios" element={<PaginaSitios />} />
          <Route
            path="/sitios/:sitioId"
            element={
              <Suspense fallback={<Cargando texto="Abriendo el sitio…" />}>
                <PaginaSitio />
              </Suspense>
            }
          />
          <Route
            path="/seguimiento/:seguimientoId"
            element={
              <Suspense fallback={<Cargando texto="Abriendo el seguimiento…" />}>
                <PaginaSeguimiento />
              </Suspense>
            }
          />
          <Route
            path="/mapa"
            element={
              <Suspense fallback={<Cargando texto="Cargando el mapa…" />}>
                <PaginaMapa />
              </Suspense>
            }
          />
          <Route path="/kanban" element={<PaginaKanban />} />
          <Route path="/pendientes" element={<PaginaPendientes />} />
          <Route
            path="/proyectos"
            element={
              <Suspense fallback={<Cargando texto="Cargando proyectos…" />}>
                <PaginaProyectos />
              </Suspense>
            }
          />
          <Route
            path="/proyectos/:proyectoId"
            element={
              <Suspense fallback={<Cargando texto="Abriendo el proyecto…" />}>
                <PaginaProyecto />
              </Suspense>
            }
          />
          <Route
            path="/importar"
            element={
              <RutaProtegida requiere={['sitios', 'importar']}>
                <Suspense fallback={<Cargando texto="Cargando el importador…" />}>
                  <PaginaImportar />
                </Suspense>
              </RutaProtegida>
            }
          />
          <Route
            path="/tracker"
            element={
              <RutaProtegida requiere={['sitios', 'importar']}>
                <Suspense fallback={<Cargando texto="Cargando el importador de trackers…" />}>
                  <PaginaImportarTracker />
                </Suspense>
              </RutaProtegida>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RutaProtegida requiere={['auditoria', 'ver']}>
                <PaginaAuditoria />
              </RutaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaProtegida requiere={['usuarios', 'editar']}>
                <PaginaUsuarios />
              </RutaProtegida>
            }
          />
          <Route
            path="/configuracion"
            element={
              <RutaProtegida requiere={['proyectos', 'editar']}>
                <PaginaConfiguracion />
              </RutaProtegida>
            }
          />
          <Route
            path="*"
            element={
              <EstadoVacio
                titulo="Esa pantalla no existe"
                descripcion="Revisa el enlace o vuelve al maestro de sitios."
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
