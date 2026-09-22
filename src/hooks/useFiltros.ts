import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  aParametros,
  desdeParametros,
  ESTADO_VACIO,
  ORDEN_POR_DEFECTO,
  type EstadoFiltros,
} from '@/app/filtrosUrl'
import type { CampoOrden, FiltrosSeguimiento, FiltrosVista } from '@/domain/vistas/filtrado'

/**
 * Los filtros viven en la URL y en ningun otro lado.
 *
 * Tener ademas un store seria duplicar la fuente de verdad y garantizar que
 * algun dia se desincronicen. Con la URL como unico estado salen gratis tres
 * cosas que en una herramienta de trabajo se piden siempre: compartir una vista
 * pegando el enlace, recargar sin perder el filtrado, y que el boton Atras
 * deshaga el ultimo filtro.
 */
export function useFiltros() {
  const [params, setParams] = useSearchParams()
  const consulta = params.toString()

  const estado = useMemo(() => desdeParametros(new URLSearchParams(consulta)), [consulta])

  const escribir = useCallback(
    (siguiente: EstadoFiltros, modo: 'push' | 'replace' = 'push') => {
      setParams(aParametros(siguiente), {
        replace: modo === 'replace',
        preventScrollReset: true,
      })
    },
    [setParams],
  )

  const fijarServidor = useCallback(
    (cambios: Partial<FiltrosSeguimiento>) =>
      escribir({ ...estado, servidor: { ...estado.servidor, ...cambios } }),
    [estado, escribir],
  )

  const fijarVista = useCallback(
    (cambios: Partial<FiltrosVista>) =>
      // El texto de busqueda se reemplaza: escribir 12 letras no debe dejar 12
      // entradas en el historial. El resto empuja, para que Atras las deshaga.
      escribir(
        { ...estado, vista: { ...estado.vista, ...cambios } },
        'texto' in cambios ? 'replace' : 'push',
      ),
    [estado, escribir],
  )

  const alternarOrden = useCallback(
    (campo: CampoOrden) =>
      escribir(
        {
          ...estado,
          orden:
            estado.orden.campo === campo
              ? { campo, direccion: estado.orden.direccion === 'asc' ? 'desc' : 'asc' }
              : { campo, direccion: campo === 'atraso' ? 'desc' : 'asc' },
        },
        'replace',
      ),
    [estado, escribir],
  )

  const limpiar = useCallback(() => escribir(ESTADO_VACIO), [escribir])

  const aplicarConsulta = useCallback(
    (nueva: string) => setParams(new URLSearchParams(nueva), { preventScrollReset: true }),
    [setParams],
  )

  return {
    ...estado,
    consulta,
    fijarServidor,
    fijarVista,
    alternarOrden,
    limpiar,
    aplicarConsulta,
    ordenPorDefecto: ORDEN_POR_DEFECTO,
  }
}
