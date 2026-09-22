import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Cargando, EstadoVacio } from '@/components/ui'
import { PaginaLogin } from '@/features/auth/PaginaLogin'
import { RutaProtegida } from '@/features/auth/RutaProtegida'
import { ProveedorCatalogos } from '@/hooks/useCatalogos'
import { ProveedorDespliegue } from '@/hooks/useDespliegue'
import { Layout } from './Layout'

// El mapa (Leaflet) y el importador (SheetJS) son los modulos pesados: se
// cargan solo cuando alguien entra a esas pantallas.
const PaginaMapa = lazy(() => import('@/features/sitios/PaginaMapa'))
const PaginaImportar = lazy(() => import('@/features/importacion/PaginaImportar'))
const PaginaImportarTracker = lazy(() => import('@/features/tracker/PaginaImportarTracker'))

import { PaginaSitios } from '@/features/sitios/PaginaSitios'
import { PaginaSitio } from '@/features/sitios/PaginaSitio'
import { PaginaSeguimiento } from '@/features/gates/PaginaSeguimiento'
import { PaginaKanban } from '@/features/kanban/PaginaKanban'
import { PaginaAuditoria } from '@/features/auditoria/PaginaAuditoria'
import { PaginaUsuarios } from '@/features/admin/PaginaUsuarios'
import { PaginaConfiguracion } from '@/features/admin/PaginaConfiguracion'

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
          <Route index element={<Navigate to="/sitios" replace />} />
          <Route path="/sitios" element={<PaginaSitios />} />
          <Route path="/sitios/:sitioId" element={<PaginaSitio />} />
          <Route path="/seguimiento/:seguimientoId" element={<PaginaSeguimiento />} />
          <Route
            path="/mapa"
            element={
              <Suspense fallback={<Cargando texto="Cargando el mapa…" />}>
                <PaginaMapa />
              </Suspense>
            }
          />
          <Route path="/kanban" element={<PaginaKanban />} />
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
              <RutaProtegida requiere={['gateTemplates', 'editar']}>
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
