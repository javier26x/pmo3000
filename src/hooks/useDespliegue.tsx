import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { observarSitios } from '@/data/repos/sitios'
import { observarSeguimientos, TOPE_SEGUIMIENTOS } from '@/data/repos/sitioProyectos'
import { usarFiltros } from '@/app/filtros'
import { usarPausaDespliegue } from '@/app/despliegue'
import {
  filtrarSeguimientos,
  ordenarSeguimientos,
  valoresDistintos,
} from '@/domain/vistas/filtrado'
import { hoyEnChile } from '@/domain/fechas'
import type { Sitio } from '@/domain/tipos/sitio'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useSesion } from './useSesion'
import { useSuscripcion } from './useSuscripcion'

interface ValorDespliegue {
  cargando: boolean
  error: string | null
  /** Maestro completo (el contratista no lo usa para navegar, pero lo lee). */
  sitios: Sitio[]
  sitioPorId: Map<string, Sitio>
  /** Seguimientos tal como los devolvio Firestore. */
  seguimientos: SitioProyecto[]
  /** Seguimientos con los filtros de vista y el orden ya aplicados. */
  visibles: SitioProyecto[]
  /** true si la consulta toco el tope y hay seguimientos que no se trajeron. */
  truncado: boolean
  tope: number
  regiones: string[]
  comunas: string[]
  hoy: string
}

const Contexto = createContext<ValorDespliegue | null>(null)

const SIN_SITIOS: Sitio[] = []
const SIN_SEGUIMIENTOS: SitioProyecto[] = []

/**
 * Una sola suscripcion a sitios y a seguimientos para toda la app. La tabla, el
 * mapa, el kanban y la paleta de comandos leen de aqui: abrir un listener por
 * pantalla multiplicaria las lecturas de Firestore sin ganar nada.
 */
export function ProveedorDespliegue({ children }: { children: ReactNode }) {
  const { actor } = useSesion()
  const pausado = usarPausaDespliegue((e) => e.pausado)
  const servidor = usarFiltros((e) => e.servidor)
  const vista = usarFiltros((e) => e.vista)
  const orden = usarFiltros((e) => e.orden)

  const suscribirSitios = useCallback(
    (cb: (d: Sitio[]) => void, onError: (e: Error) => void) => observarSitios(cb, onError),
    [],
  )

  const claveServidor = JSON.stringify(servidor)
  const suscribirSeguimientos = useCallback(
    (cb: (d: SitioProyecto[]) => void, onError: (e: Error) => void) => {
      if (!actor) return () => {}
      return observarSeguimientos(actor, JSON.parse(claveServidor) as typeof servidor, cb, onError)
    },
    // claveServidor serializa los filtros: sin esto la suscripcion se rearmaria
    // en cada render porque el objeto de filtros es nuevo cada vez.
    [actor, claveServidor],
  )

  const activo = actor !== null && !pausado
  const resSitios = useSuscripcion(activo ? suscribirSitios : null, SIN_SITIOS)
  const resSeguimientos = useSuscripcion(activo ? suscribirSeguimientos : null, SIN_SEGUIMIENTOS)

  const valor = useMemo<ValorDespliegue>(() => {
    const hoy = hoyEnChile()
    const filtrados = filtrarSeguimientos(resSeguimientos.datos, vista, hoy)
    return {
      cargando: resSitios.cargando || resSeguimientos.cargando,
      error: resSitios.error ?? resSeguimientos.error,
      sitios: resSitios.datos,
      sitioPorId: new Map(resSitios.datos.map((s) => [s.id, s])),
      seguimientos: resSeguimientos.datos,
      visibles: ordenarSeguimientos(filtrados, orden.campo, orden.direccion, hoy),
      truncado: resSeguimientos.datos.length >= TOPE_SEGUIMIENTOS,
      tope: TOPE_SEGUIMIENTOS,
      regiones: valoresDistintos(resSeguimientos.datos, (s) => s.region),
      comunas: valoresDistintos(
        resSeguimientos.datos.filter((s) => !vista.region || s.region === vista.region),
        (s) => s.comuna,
      ),
      hoy,
    }
  }, [resSitios, resSeguimientos, vista, orden])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useDespliegue(): ValorDespliegue {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useDespliegue debe usarse dentro de ProveedorDespliegue')
  return valor
}
