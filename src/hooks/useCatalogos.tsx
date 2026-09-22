import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  observarCelulas,
  observarPlantillas,
  observarPortafolios,
  observarProgramas,
  observarProveedores,
  observarProyectos,
} from '@/data/repos/catalogos'
import { observarUsuarios } from '@/data/repos/usuarios'
import { mensajeDeError } from '@/app/avisos'
import type { EtapaCatalogo } from '@/domain/gates/catalogo'
import type {
  Celula,
  GateTemplate,
  Portafolio,
  Programa,
  Proveedor,
  Proyecto,
  Usuario,
} from '@/domain/tipos'
import { useSesion } from './useSesion'

interface ValorCatalogos {
  cargando: boolean
  error: string | null
  celulas: Celula[]
  proveedores: Proveedor[]
  portafolios: Portafolio[]
  programas: Programa[]
  proyectos: Proyecto[]
  plantillas: GateTemplate[]
  /** Etapas de todas las plantillas activas, en orden. Ver domain/gates/catalogo.ts. */
  etapas: EtapaCatalogo[]
  usuarios: Usuario[]
  nombreCelula: (id: string | null) => string
  nombreProveedor: (id: string | null) => string
  nombrePrograma: (id: string | null) => string
  nombreProyecto: (id: string | null) => string
  nombreUsuario: (uid: string | null) => string
  plantillaPorId: (id: string) => GateTemplate | null
}

const Contexto = createContext<ValorCatalogos | null>(null)

/**
 * Catalogos en memoria. Son pocos documentos, se necesitan en casi toda la app y
 * cambian poco: un listener por coleccion sale mucho mas barato que resolver
 * nombres a demanda en cada fila de una tabla de miles.
 *
 * El contratista no tiene permiso sobre portafolios, programas ni la nomina, asi
 * que esas suscripciones no se abren para su rol (abrirlas solo produciria
 * errores de permiso en consola).
 */
export function ProveedorCatalogos({ children }: { children: ReactNode }) {
  const { perfil } = useSesion()
  const rol = perfil?.rol ?? null

  const [celulas, setCelulas] = useState<Celula[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [portafolios, setPortafolios] = useState<Portafolio[]>([])
  const [programas, setProgramas] = useState<Programa[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [plantillas, setPlantillas] = useState<GateTemplate[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [error, setError] = useState<string | null>(null)
  /**
   * Colecciones cuyo primer snapshot ya llego. Se usa para saber si seguimos
   * cargando sin inventar un temporizador: una coleccion vacia tambien "llego".
   */
  const [recibidas, setRecibidas] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!rol) return
    const alFallar = (e: Error) => setError(mensajeDeError(e))

    const marcar = (nombre: string) =>
      setRecibidas((previas) => (previas.has(nombre) ? previas : new Set(previas).add(nombre)))

    /** Envuelve el callback para registrar la llegada del primer snapshot. */
    const recibir =
      <T,>(nombre: string, aplicar: (datos: T) => void) =>
      (datos: T) => {
        aplicar(datos)
        marcar(nombre)
      }

    // El contratista no tiene permiso sobre portafolios, programas ni la nomina:
    // abrir esas suscripciones para su rol solo produciria errores de permiso.
    const interno = rol !== 'contratista'

    const cancelaciones = [
      observarCelulas(recibir('celulas', setCelulas), alFallar),
      observarProveedores(recibir('proveedores', setProveedores), alFallar),
      observarPlantillas(recibir('plantillas', setPlantillas), alFallar),
      ...(interno
        ? [
            observarPortafolios(recibir('portafolios', setPortafolios), alFallar),
            observarProgramas(recibir('programas', setProgramas), alFallar),
            observarProyectos(recibir('proyectos', setProyectos), alFallar),
            observarUsuarios(recibir('usuarios', setUsuarios), alFallar),
          ]
        : []),
    ]

    return () => cancelaciones.forEach((cancelar) => cancelar())
  }, [rol])

  const esperadas = rol === null ? 0 : rol === 'contratista' ? 3 : 7

  const valor = useMemo<ValorCatalogos>(() => {
    const indice = <T extends { id: string; nombre: string }>(lista: T[]) =>
      new Map(lista.map((x) => [x.id, x.nombre]))

    const celulasPorId = indice(celulas)
    const proveedoresPorId = indice(proveedores)
    const programasPorId = indice(programas)
    const proyectosPorId = indice(proyectos)
    const usuariosPorId = new Map(usuarios.map((u) => [u.id, u.nombre]))
    const plantillasPorId = new Map(plantillas.map((p) => [p.id, p]))

    // Las vistas que cruzan programas (embudo, kanban, filtros, leyenda del
    // mapa) necesitan la lista de etapas, y cada programa puede tener su propia
    // plantilla. Se unen por codigo: si dos plantillas usan el mismo codigo, se
    // respeta la posicion mas temprana, que es la que ordena la columna.
    const porCodigo = new Map<string, EtapaCatalogo>()
    for (const plantilla of plantillas) {
      if (!plantilla.activo) continue
      for (const g of plantilla.gates) {
        const previa = porCodigo.get(g.codigo)
        if (previa === undefined || g.orden < previa.orden) {
          porCodigo.set(g.codigo, {
            codigo: g.codigo,
            nombre: g.nombre,
            descripcion: g.descripcion,
            color: g.color,
            orden: g.orden,
          })
        }
      }
    }
    const etapas = [...porCodigo.values()].sort(
      (a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo),
    )

    const resolver = (mapa: Map<string, string>) => (id: string | null) =>
      id ? (mapa.get(id) ?? id) : '—'

    return {
      cargando: recibidas.size < esperadas,
      error,
      celulas,
      proveedores,
      portafolios,
      programas,
      proyectos,
      plantillas,
      etapas,
      usuarios,
      nombreCelula: resolver(celulasPorId),
      nombreProveedor: resolver(proveedoresPorId),
      nombrePrograma: resolver(programasPorId),
      nombreProyecto: resolver(proyectosPorId),
      nombreUsuario: resolver(usuariosPorId),
      plantillaPorId: (id) => plantillasPorId.get(id) ?? null,
    }
  }, [
    celulas,
    proveedores,
    portafolios,
    programas,
    proyectos,
    plantillas,
    usuarios,
    error,
    recibidas,
    esperadas,
  ])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useCatalogos(): ValorCatalogos {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useCatalogos debe usarse dentro de ProveedorCatalogos')
  return valor
}

/**
 * Solo las etapas, y sin exigir el proveedor.
 *
 * Lo usan las insignias y los puntos de gate, que aparecen en todas partes y no
 * deberian obligar a cada pantalla a pasarles el catalogo. Sin proveedor
 * devuelve vacio y la insignia cae al codigo crudo, que sigue siendo legible.
 */
export function useEtapas(): EtapaCatalogo[] {
  return useContext(Contexto)?.etapas ?? []
}
