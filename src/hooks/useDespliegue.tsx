import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  observarSeguimientos,
  TOPE_PRIMERA_TANDA,
  TOPE_SEGUIMIENTOS,
} from '@/data/repos/sitioProyectos'
import { usarPausaDespliegue } from '@/app/despliegue'
import {
  filtrarSeguimientos,
  ordenarSeguimientos,
  valoresDistintos,
  type FiltrosSeguimiento,
} from '@/domain/vistas/filtrado'
import { hoyEnChile } from '@/domain/fechas'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useFiltros } from './useFiltros'
import { useSesion } from './useSesion'
import { useSuscripcion } from './useSuscripcion'

/** Lo mínimo de un sitio que necesita la paleta de comandos. */
export interface SitioMinimo {
  id: string
  nombre: string
  comuna: string
  region: string
}

interface ValorDespliegue {
  cargando: boolean
  error: string | null
  /** Sitios distintos presentes en el seguimiento cargado, para buscarlos. */
  sitios: SitioMinimo[]
  /** Seguimientos tal como los devolvio Firestore. */
  seguimientos: SitioProyecto[]
  /** Seguimientos con los filtros de vista y el orden ya aplicados. */
  visibles: SitioProyecto[]
  /** Igual que `visibles` pero sin aplicar el filtro de gate: lo usa el embudo,
   *  que debe seguir mostrando la distribución completa aunque haya un gate
   *  seleccionado. */
  sinFiltroGate: SitioProyecto[]
  /** true si la consulta tocó el tope y hay seguimientos que no se trajeron. */
  truncado: boolean
  tope: number
  /** Se está mostrando la primera tanda mientras llega el resto. */
  completando: boolean
  regiones: string[]
  comunas: string[]
  hoy: string
}

const Contexto = createContext<ValorDespliegue | null>(null)

/**
 * Canal por el que una pantalla avisa que necesita el seguimiento.
 *
 * Va en su propio contexto, y no dentro de ValorDespliegue, porque su valor
 * tiene que ser estable: si cambiara junto con los datos, el efecto que lo usa
 * se volveria a ejecutar en cada snapshot.
 */
const ContextoDemanda = createContext<(() => void) | null>(null)

const SIN_SEGUIMIENTOS: SitioProyecto[] = []

const CLAVE_CACHE = 'pmo3000.cacheSeguimiento'

/** Hubo en este navegador una carga completa que dejó la cache local poblada. */
function cacheCompletaPrevia(): boolean {
  try {
    return localStorage.getItem(CLAVE_CACHE) === '1'
  } catch {
    return false
  }
}

function marcarCacheCompleta(): void {
  try {
    localStorage.setItem(CLAVE_CACHE, '1')
  } catch {
    // Sin almacenamiento solo se pierde el atajo; la carga funciona igual.
  }
}

/**
 * Una sola suscripción al seguimiento para toda la app: la tabla, el mapa, el
 * kanban y la paleta leen de aquí. Abrir un listener por pantalla multiplicaría
 * las lecturas de Firestore sin ganar nada.
 *
 * Deliberadamente NO se escucha el maestro `sitios` completo. El documento de
 * seguimiento ya trae desnormalizado el nombre, la comuna y la región del sitio,
 * así que esa segunda suscripción solo agregaba ~1.200 documentos a la carga
 * inicial sin aportar un dato nuevo. La ficha del sitio sí lee su documento del
 * maestro, pero de a uno.
 *
 * La suscripción no se abre hasta que alguna pantalla la pide. El proveedor
 * envuelve TODAS las rutas (lo necesita la paleta de comandos, que se abre desde
 * cualquier parte), así que sin esto entrar por enlace directo a la ficha de un
 * seguimiento —el caso más común cuando alguien comparte un sitio por correo—
 * se traía los ~1.500 documentos del despliegue compitiendo con el único
 * documento que esa pantalla necesita. Lo mismo en configuración, usuarios y
 * auditoría.
 *
 * Quien la pide es `useDespliegue()` mismo: así no hay una lista de rutas que
 * mantener sincronizada (el Layout ya tiene la suya para otra cosa) y una
 * pantalla nueva que lea el despliegue queda cubierta sola.
 *
 * Es un pestillo de una sola vía: una vez armada no se suelta. Soltarla al salir
 * de la lista haría que volver a entrar pagara de nuevo la consulta, y en una
 * navegación normal (tabla → ficha → tabla) eso es peor que mantenerla viva.
 */
export function ProveedorDespliegue({ children }: { children: ReactNode }) {
  const { actor } = useSesion()
  const pausado = usarPausaDespliegue((e) => e.pausado)
  const { servidor, vista, orden } = useFiltros()

  // Los filtros de servidor se serializan para que la suscripcion se rearme solo
  // cuando cambian de verdad, y no en cada render por ser un objeto nuevo.
  // claveServidor serializa los filtros: sin esto la suscripción se rearmaría en
  // cada render, porque el objeto de filtros es nuevo cada vez.
  const claveServidor = JSON.stringify(servidor)

  const suscribirPrimeraTanda = useCallback(
    (cb: (d: SitioProyecto[]) => void, onError: (e: Error) => void) => {
      if (!actor) return () => {}
      const filtros = JSON.parse(claveServidor) as FiltrosSeguimiento
      return observarSeguimientos(actor, filtros, cb, onError, TOPE_PRIMERA_TANDA)
    },
    [actor, claveServidor],
  )

  const suscribirTodo = useCallback(
    (cb: (d: SitioProyecto[]) => void, onError: (e: Error) => void) => {
      if (!actor) return () => {}
      const filtros = JSON.parse(claveServidor) as FiltrosSeguimiento
      return observarSeguimientos(actor, filtros, cb, onError, TOPE_SEGUIMIENTOS)
    },
    [actor, claveServidor],
  )

  // Pestillo: false hasta que la primera pantalla que usa el despliegue se monta.
  const [pedido, setPedido] = useState(false)
  const pedir = useCallback(() => setPedido(true), [])

  const activo = actor !== null && !pausado && pedido
  // Dos suscripciones a la misma consulta con topes distintos. Las 150 lecturas
  // extra de la tanda corta son un precio barato por pintar 8 segundos antes.
  //
  // La completa arranca recien cuando la corta ya pinto: si salen juntas, el SDK
  // procesa las dos respuestas en el mismo hilo y la corta llega casi al mismo
  // tiempo que la larga, que es justo lo que se queria evitar. Con cache local
  // la corta responde en milisegundos, asi que la espera no se nota.
  //
  // Con la cache ya poblada conviene lo contrario: el SDK lee las dos del disco
  // en paralelo mas rapido que en serie (medido: 2,6 s contra 4,5 s con CPU
  // lenta). Por eso se recuerda, por navegador, si ya hubo una carga completa.
  const [completoArmado, setCompletoArmado] = useState(cacheCompletaPrevia)
  const resCompleto = useSuscripcion(
    activo && completoArmado ? suscribirTodo : null,
    SIN_SEGUIMIENTOS,
  )
  // Apenas llega la consulta completa, la tanda corta se cierra. Dejarla abierta
  // obligaba al SDK a mantener dos vistas de los mismos documentos y a procesar
  // cada cambio dos veces: medido, era la mitad del trabajo del hilo principal.
  // `activo &&` no es decorativo: sin la suscripcion armada resCompleto.cargando
  // es false, y "no esta cargando" se leeria como "la consulta completa ya
  // llego", dejando la pantalla con cero seguimientos y sin senal de carga.
  const completoListo =
    activo && completoArmado && (resCompleto.datos.length > 0 || !resCompleto.cargando)
  const resRapido = useSuscripcion(
    activo && !completoListo ? suscribirPrimeraTanda : null,
    SIN_SEGUIMIENTOS,
  )
  // Se ajusta durante el render (no en un efecto) para no pintar un cuadro
  // intermedio: React re-ejecuta este componente al tiro con el valor nuevo.
  if (activo && !resRapido.cargando && !completoArmado) setCompletoArmado(true)
  useEffect(() => {
    if (resCompleto.datos.length > 0) marcarCacheCompleta()
  }, [resCompleto.datos.length])

  // Se desarma el resultado en sus tres partes antes del memo. useSuscripcion
  // devuelve un objeto nuevo en cada render, asi que teniendolo como dependencia
  // el memo no acertaba nunca: recalculaba filtros, orden y listas de valores en
  // cada render del proveedor, y al devolver un valor nuevo hacia re-renderizar
  // a todos sus consumidores. Con los campos sueltos solo recalcula si el dato
  // cambio de verdad.
  const { datos: datosRapido, cargando: cargandoRapido, error: errorRapido } = resRapido
  const { datos: datosCompleto, error: errorCompleto } = resCompleto

  const valor = useMemo<ValorDespliegue>(() => {
    const hoy = hoyEnChile()
    // Mientras la consulta completa no llegue, se trabaja sobre la tanda corta.
    const completo = completoListo
    const datos = completo ? datosCompleto : datosRapido
    const filtrados = filtrarSeguimientos(datos, vista, hoy)
    const sinFiltroGate = vista.gateActual
      ? filtrarSeguimientos(datos, { ...vista, gateActual: null }, hoy)
      : filtrados

    // Un sitio puede estar en varios proyectos: para buscarlo basta una entrada.
    const sitios = new Map<string, SitioMinimo>()
    for (const sp of datos) {
      if (!sitios.has(sp.sitioId)) {
        sitios.set(sp.sitioId, {
          id: sp.sitioId,
          nombre: sp.sitioNombre,
          comuna: sp.comuna,
          region: sp.region,
        })
      }
    }

    return {
      // "Cargando" es no tener nada que mostrar: con la tanda corta en pantalla ya
      // no lo es, aunque la completa siga en camino (eso es `completando`).
      // `!pedido` cubre el render en que una pantalla ya se esta montando pero
      // el pestillo todavia no se abrio (lo abre un efecto de layout). Sin eso,
      // en ese instante hay cero seguimientos y nada marcado como cargando, que
      // es exactamente lo que la tabla dibuja como "no hay sitios".
      cargando: !completo && (cargandoRapido || !completoArmado || !pedido),
      completando: !completo,
      error: errorCompleto ?? errorRapido,
      sitios: [...sitios.values()],
      seguimientos: datos,
      visibles: ordenarSeguimientos(filtrados, orden.campo, orden.direccion, hoy),
      sinFiltroGate,
      truncado: datos.length >= TOPE_SEGUIMIENTOS,
      tope: TOPE_SEGUIMIENTOS,
      regiones: valoresDistintos(datos, (s) => s.region),
      comunas: valoresDistintos(
        datos.filter((s) => !vista.region || s.region === vista.region),
        (s) => s.comuna,
      ),
      hoy,
    }
  }, [
    datosRapido,
    cargandoRapido,
    errorRapido,
    datosCompleto,
    errorCompleto,
    completoListo,
    completoArmado,
    pedido,
    vista,
    orden,
  ])

  return (
    <ContextoDemanda.Provider value={pedir}>
      <Contexto.Provider value={valor}>{children}</Contexto.Provider>
    </ContextoDemanda.Provider>
  )
}

/**
 * Datos del despliegue. Usarlo ES pedir la suscripción: el proveedor la abre en
 * cuanto se monta la primera pantalla que llama a este hook.
 */
export function useDespliegue(): ValorDespliegue {
  const valor = useContext(Contexto)
  const pedir = useContext(ContextoDemanda)
  // De layout y no de efecto normal: un efecto corre despues de pintar, asi que
  // habria un cuadro con la suscripcion sin armar y la lista vacia.
  useLayoutEffect(() => {
    pedir?.()
  }, [pedir])
  if (!valor) throw new Error('useDespliegue debe usarse dentro de ProveedorDespliegue')
  return valor
}
