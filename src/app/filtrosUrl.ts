/**
 * Codificacion de los filtros en la URL.
 *
 * El objetivo es concreto: que una vista se pueda compartir pegando el enlace.
 * "Mira los atrasados del Plan 200 en Biobio" deja de ser una instruccion y pasa
 * a ser un link. Tambien hace que recargar la pagina no pierda el trabajo de
 * filtrado, y que el boton Atras del navegador haga lo esperable.
 *
 * Es codigo puro: recibe y devuelve datos, sin tocar el store ni el router.
 */
import {
  CAMPOS_ORDEN,
  FILTROS_SERVIDOR_VACIOS,
  FILTROS_VIGENCIA,
  FILTROS_VISTA_VACIOS,
  gateDesdeTexto,
  type CampoOrden,
  type DireccionOrden,
  type FiltroVigencia,
  type FiltrosSeguimiento,
  type FiltrosVista,
} from '@/domain/vistas/filtrado'
import { PRIORIDADES, type Prioridad } from '@/domain/tipos/comunes'

export interface EstadoFiltros {
  servidor: FiltrosSeguimiento
  vista: FiltrosVista
  orden: { campo: CampoOrden; direccion: DireccionOrden }
}

export const ORDEN_POR_DEFECTO: EstadoFiltros['orden'] = { campo: 'atraso', direccion: 'desc' }

export const ESTADO_VACIO: EstadoFiltros = {
  servidor: FILTROS_SERVIDOR_VACIOS,
  vista: FILTROS_VISTA_VACIOS,
  orden: ORDEN_POR_DEFECTO,
}

/** Claves cortas: la URL tiene que seguir siendo legible y pegable. */
const CLAVES = {
  programaId: 'prog',
  proyectoId: 'proy',
  proveedorId: 'prov',
  celulaId: 'cel',
  gateActual: 'gate',
  texto: 'q',
  region: 'reg',
  comuna: 'com',
  prioridad: 'pri',
  soloAtrasados: 'atr',
  soloBloqueados: 'blo',
  vigencia: 'vig',
  orden: 'ord',
} as const

export function aParametros(estado: EstadoFiltros): URLSearchParams {
  const p = new URLSearchParams()
  const poner = (clave: string, valor: string | null) => {
    if (valor && valor.trim() !== '') p.set(clave, valor)
  }

  poner(CLAVES.programaId, estado.servidor.programaId)
  poner(CLAVES.proyectoId, estado.servidor.proyectoId)
  poner(CLAVES.proveedorId, estado.servidor.proveedorId)
  poner(CLAVES.celulaId, estado.servidor.celulaId)

  poner(CLAVES.gateActual, estado.vista.gateActual)
  // Sin recortar: el buscador lee su valor de la URL mientras se escribe, y
  // recortar aca se comia el espacio de "cerro " antes de la siguiente letra.
  // El filtrado ya ignora los espacios de los extremos.
  poner(CLAVES.texto, estado.vista.texto)
  poner(CLAVES.region, estado.vista.region)
  poner(CLAVES.comuna, estado.vista.comuna)
  poner(CLAVES.prioridad, estado.vista.prioridad)
  if (estado.vista.soloAtrasados) p.set(CLAVES.soloAtrasados, '1')
  if (estado.vista.soloBloqueados) p.set(CLAVES.soloBloqueados, '1')
  // Como el orden, la vigencia solo viaja si no es la de por defecto.
  if (estado.vista.vigencia !== FILTROS_VISTA_VACIOS.vigencia) {
    p.set(CLAVES.vigencia, estado.vista.vigencia)
  }

  // El orden solo viaja si no es el de por defecto: una URL sin filtros queda limpia.
  if (
    estado.orden.campo !== ORDEN_POR_DEFECTO.campo ||
    estado.orden.direccion !== ORDEN_POR_DEFECTO.direccion
  ) {
    p.set(CLAVES.orden, `${estado.orden.campo}:${estado.orden.direccion}`)
  }

  return p
}

function texto(p: URLSearchParams, clave: string): string | null {
  const valor = p.get(clave)
  return valor && valor.trim() !== '' ? valor.trim() : null
}

export function desdeParametros(p: URLSearchParams): EstadoFiltros {
  const ordenCrudo = texto(p, CLAVES.orden)?.split(':') ?? []
  const campo = ordenCrudo[0] as CampoOrden | undefined
  const direccion = ordenCrudo[1]

  const prioridad = texto(p, CLAVES.prioridad)
  const vigencia = texto(p, CLAVES.vigencia)

  return {
    servidor: {
      programaId: texto(p, CLAVES.programaId),
      proyectoId: texto(p, CLAVES.proyectoId),
      proveedorId: texto(p, CLAVES.proveedorId),
      celulaId: texto(p, CLAVES.celulaId),
    },
    vista: {
      gateActual: gateDesdeTexto(texto(p, CLAVES.gateActual)),
      texto: texto(p, CLAVES.texto) === null ? '' : (p.get(CLAVES.texto) ?? ''),
      region: texto(p, CLAVES.region),
      comuna: texto(p, CLAVES.comuna),
      prioridad:
        prioridad && (PRIORIDADES as readonly string[]).includes(prioridad)
          ? (prioridad as Prioridad)
          : null,
      soloAtrasados: p.get(CLAVES.soloAtrasados) === '1',
      soloBloqueados: p.get(CLAVES.soloBloqueados) === '1',
      vigencia:
        vigencia && (FILTROS_VIGENCIA as readonly string[]).includes(vigencia)
          ? (vigencia as FiltroVigencia)
          : FILTROS_VISTA_VACIOS.vigencia,
    },
    orden: {
      campo:
        campo && (CAMPOS_ORDEN as readonly string[]).includes(campo)
          ? campo
          : ORDEN_POR_DEFECTO.campo,
      direccion:
        direccion === 'asc' || direccion === 'desc' ? direccion : ORDEN_POR_DEFECTO.direccion,
    },
  }
}

/** Texto de la query, sin el `?`. Vacio si no hay nada que codificar. */
export function aTextoUrl(estado: EstadoFiltros): string {
  return aParametros(estado).toString()
}

export function sonIguales(a: EstadoFiltros, b: EstadoFiltros): boolean {
  return aTextoUrl(a) === aTextoUrl(b)
}
