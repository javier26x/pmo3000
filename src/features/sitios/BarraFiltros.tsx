import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ListFilter,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  Boton,
  Chip,
  Entrada,
  ItemMenu,
  PanelMenu,
  SeparadorMenu,
  TituloMenu,
  cn,
  useMenuFlotante,
} from '@/components/ui'
import { borrarVista, guardarVista, leerVistas, type VistaGuardada } from '@/app/vistas'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useDespliegue } from '@/hooks/useDespliegue'
import { useFiltros } from '@/hooks/useFiltros'
import { useSesion } from '@/hooks/useSesion'
import { CODIGOS_GATE, nombreGate } from '@/domain/gates/catalogo'
import { NOMBRES_PRIORIDAD, PRIORIDADES } from '@/domain/tipos/comunes'
import type { FiltrosSeguimiento, FiltrosVista } from '@/domain/vistas/filtrado'

/** Un filtro disponible: de dónde saca sus opciones y cómo se lee. */
interface DefinicionFiltro {
  clave: string
  etiqueta: string
  /** Solo para roles internos (el contratista ya viene acotado a su proveedor). */
  soloInterno?: boolean
  opciones: { valor: string; texto: string }[]
  activo: string | null
  aplicar: (valor: string | null) => void
}

interface FiltroBooleano {
  clave: 'soloAtrasados' | 'soloBloqueados'
  etiqueta: string
  activo: boolean
}

export function BarraFiltros({ compacta = false }: { compacta?: boolean }) {
  const { perfil } = useSesion()
  const { programas, proyectos, proveedores, celulas } = useCatalogos()
  const { regiones, comunas } = useDespliegue()
  const { servidor, vista, consulta, fijarServidor, fijarVista, limpiar, aplicarConsulta } =
    useFiltros()

  const esContratista = perfil?.rol === 'contratista'

  const opcionesDe = (lista: { id: string; nombre: string }[]) =>
    lista.map((x) => ({ valor: x.id, texto: x.nombre }))

  const definiciones: DefinicionFiltro[] = useMemo(() => {
    const proyectosVisibles = servidor.programaId
      ? proyectos.filter((p) => p.programaId === servidor.programaId)
      : proyectos

    const servidorSetter = (clave: keyof FiltrosSeguimiento) => (valor: string | null) =>
      fijarServidor(
        clave === 'programaId'
          ? ({ programaId: valor, proyectoId: null } as Partial<FiltrosSeguimiento>)
          : ({ [clave]: valor } as Partial<FiltrosSeguimiento>),
      )

    const vistaSetter = (clave: keyof FiltrosVista) => (valor: string | null) =>
      fijarVista(
        clave === 'region'
          ? ({ region: valor, comuna: null } as Partial<FiltrosVista>)
          : ({ [clave]: valor } as Partial<FiltrosVista>),
      )

    return [
      {
        clave: 'programa',
        etiqueta: 'Programa',
        soloInterno: true,
        opciones: opcionesDe(programas),
        activo: servidor.programaId,
        aplicar: servidorSetter('programaId'),
      },
      {
        clave: 'proyecto',
        etiqueta: 'Proyecto',
        soloInterno: true,
        opciones: opcionesDe(proyectosVisibles),
        activo: servidor.proyectoId,
        aplicar: servidorSetter('proyectoId'),
      },
      {
        clave: 'gate',
        etiqueta: 'Gate',
        opciones: [
          ...CODIGOS_GATE.map((g) => ({ valor: g, texto: nombreGate(g) })),
          { valor: 'CERRADO', texto: 'Cerrado' },
        ],
        activo: vista.gateActual,
        aplicar: vistaSetter('gateActual'),
      },
      {
        clave: 'proveedor',
        etiqueta: 'Proveedor',
        soloInterno: true,
        opciones: opcionesDe(proveedores),
        activo: servidor.proveedorId,
        aplicar: servidorSetter('proveedorId'),
      },
      {
        clave: 'celula',
        etiqueta: 'Célula',
        soloInterno: true,
        opciones: opcionesDe(celulas),
        activo: servidor.celulaId,
        aplicar: servidorSetter('celulaId'),
      },
      {
        clave: 'region',
        etiqueta: 'Región',
        opciones: regiones.map((r) => ({ valor: r, texto: r })),
        activo: vista.region,
        aplicar: vistaSetter('region'),
      },
      {
        clave: 'comuna',
        etiqueta: 'Comuna',
        opciones: comunas.map((c) => ({ valor: c, texto: c })),
        activo: vista.comuna,
        aplicar: vistaSetter('comuna'),
      },
      {
        clave: 'prioridad',
        etiqueta: 'Prioridad',
        opciones: PRIORIDADES.map((p) => ({ valor: p, texto: NOMBRES_PRIORIDAD[p] })),
        activo: vista.prioridad,
        aplicar: vistaSetter('prioridad'),
      },
    ].filter((d) => !d.soloInterno || !esContratista)
  }, [
    programas,
    proyectos,
    proveedores,
    celulas,
    regiones,
    comunas,
    servidor,
    vista,
    esContratista,
    fijarServidor,
    fijarVista,
  ])

  const booleanos: FiltroBooleano[] = [
    { clave: 'soloAtrasados', etiqueta: 'Solo atrasados', activo: vista.soloAtrasados },
    { clave: 'soloBloqueados', etiqueta: 'Solo bloqueados', activo: vista.soloBloqueados },
  ]

  const activos = definiciones.filter((d) => d.activo !== null)
  const disponibles = definiciones.filter((d) => d.activo === null)
  const hayAlgo = activos.length > 0 || booleanos.some((b) => b.activo) || vista.texto.trim() !== ''

  const textoDe = (d: DefinicionFiltro) =>
    d.opciones.find((o) => o.valor === d.activo)?.texto ?? d.activo ?? ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <BuscadorSitios valor={vista.texto} onCambiar={(texto) => fijarVista({ texto })} />

        <MenuAgregarFiltro
          disponibles={disponibles}
          booleanos={booleanos}
          onBooleano={fijarVista}
        />

        {!compacta && <MenuVistas consulta={consulta} onAplicar={aplicarConsulta} />}

        <div className="flex flex-wrap items-center gap-1.5">
          {activos.map((d) => (
            <ChipConMenu key={d.clave} definicion={d} texto={textoDe(d)} />
          ))}

          {booleanos
            .filter((b) => b.activo)
            .map((b) => (
              <Chip
                key={b.clave}
                campo="Estado"
                valor={b.etiqueta.replace('Solo ', '')}
                onQuitar={() => fijarVista({ [b.clave]: false } as Partial<FiltrosVista>)}
              />
            ))}
        </div>

        {hayAlgo && (
          <Boton
            variante="fantasma"
            tamano="sm"
            onClick={limpiar}
            icono={<X aria-hidden className="size-3.5" />}
          >
            Limpiar
          </Boton>
        )}
      </div>
    </div>
  )
}

/** Búsqueda con atajo `/` y limpieza con Escape. */
function BuscadorSitios({
  valor,
  onCambiar,
}: {
  valor: string
  onCambiar: (texto: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const dentroDeCampo =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable)
      if (e.key === '/' && !dentroDeCampo && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  return (
    <div className="relative min-w-48 flex-1 sm:max-w-64">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-texto-3"
      />
      <Entrada
        ref={ref}
        type="search"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onCambiar('')
            e.currentTarget.blur()
          }
        }}
        placeholder="Buscar sitio…"
        aria-label="Buscar sitios por ID, nombre o comuna"
        className="pr-8 pl-7"
      />
      {valor === '' && (
        <span
          aria-hidden
          className="tecla pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
        >
          /
        </span>
      )}
    </div>
  )
}

/** Chip que al pulsarse reabre su lista de valores. */
function ChipConMenu({ definicion, texto }: { definicion: DefinicionFiltro; texto: string }) {
  const { abierto, alternar, cerrar, disparadorRef, panelRef, posicion } = useMenuFlotante()

  return (
    <>
      <span ref={undefined}>
        <Chip
          campo={definicion.etiqueta}
          valor={texto}
          onQuitar={() => definicion.aplicar(null)}
          onAbrir={alternar}
        />
      </span>
      {/* El disparador real es invisible: el chip ya es el control visible. */}
      <button ref={disparadorRef} type="button" className="sr-only" tabIndex={-1} aria-hidden />

      {abierto && (
        <PanelMenu
          panelRef={panelRef}
          posicion={posicion}
          etiquetaAria={`Valores de ${definicion.etiqueta}`}
        >
          <ListaOpciones
            definicion={definicion}
            onElegir={(valor) => {
              definicion.aplicar(valor)
              cerrar(false)
            }}
          />
        </PanelMenu>
      )}
    </>
  )
}

/** Lista de valores con buscador cuando hay muchos (comunas, proveedores). */
function ListaOpciones({
  definicion,
  onElegir,
}: {
  definicion: DefinicionFiltro
  onElegir: (valor: string | null) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const conBuscador = definicion.opciones.length > 8

  const visibles = definicion.opciones.filter((o) =>
    busqueda.trim() === ''
      ? true
      : o.texto
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .includes(busqueda.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()),
  )

  return (
    <>
      <TituloMenu>{definicion.etiqueta}</TituloMenu>

      {conBuscador && (
        <div className="px-1 pb-1">
          <Entrada
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Filtrar ${definicion.etiqueta.toLowerCase()}…`}
            aria-label={`Filtrar ${definicion.etiqueta}`}
            className="h-7"
          />
        </div>
      )}

      {visibles.length === 0 && (
        <p className="px-2 py-3 text-center text-xs text-texto-3">Sin coincidencias</p>
      )}

      {visibles.map((o) => (
        <ItemMenu
          key={o.valor}
          onClick={() => onElegir(o.valor)}
          activo={definicion.activo === o.valor}
          icono={
            definicion.activo === o.valor ? <Check aria-hidden className="size-3.5" /> : undefined
          }
        >
          {o.texto}
        </ItemMenu>
      ))}

      {definicion.activo !== null && (
        <>
          <SeparadorMenu />
          <ItemMenu onClick={() => onElegir(null)} icono={<X aria-hidden className="size-3.5" />}>
            Quitar filtro
          </ItemMenu>
        </>
      )}
    </>
  )
}

/** Menú de dos pasos: primero el campo, después el valor. */
function MenuAgregarFiltro({
  disponibles,
  booleanos,
  onBooleano,
}: {
  disponibles: DefinicionFiltro[]
  booleanos: FiltroBooleano[]
  onBooleano: (cambios: Partial<FiltrosVista>) => void
}) {
  const [elegido, setElegido] = useState<DefinicionFiltro | null>(null)
  const { abierto, alternar, cerrar, disparadorRef, panelRef, posicion } = useMenuFlotante(() =>
    setElegido(null),
  )

  const sinNada = disponibles.length === 0 && booleanos.every((b) => b.activo)

  return (
    <>
      <button
        ref={disparadorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={sinNada}
        onClick={alternar}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-dashed border-borde-fuerte',
          'px-2.5 text-sm font-medium whitespace-nowrap text-texto-2',
          'transition-colors duration-[var(--ms-instante)]',
          'hover:border-[var(--acento)] hover:bg-[var(--acento-suave)] hover:text-[var(--acento)]',
          'disabled:pointer-events-none disabled:opacity-40',
          abierto && 'border-[var(--acento)] bg-[var(--acento-suave)] text-[var(--acento)]',
        )}
      >
        <Plus aria-hidden className="size-3.5" />
        Filtro
      </button>

      {abierto && (
        <PanelMenu panelRef={panelRef} posicion={posicion} etiquetaAria="Agregar filtro">
          {elegido ? (
            <>
              <ItemMenu
                onClick={() => setElegido(null)}
                icono={<ChevronLeft aria-hidden className="size-3.5" />}
              >
                Volver
              </ItemMenu>
              <SeparadorMenu />
              <ListaOpciones
                definicion={elegido}
                onElegir={(valor) => {
                  elegido.aplicar(valor)
                  cerrar(false)
                  setElegido(null)
                }}
              />
            </>
          ) : (
            <>
              <TituloMenu>Filtrar por</TituloMenu>
              {disponibles.map((d) => (
                <ItemMenu
                  key={d.clave}
                  onClick={() => setElegido(d)}
                  icono={<ListFilter aria-hidden className="size-3.5" />}
                >
                  {d.etiqueta}
                </ItemMenu>
              ))}

              {booleanos.some((b) => !b.activo) && <SeparadorMenu />}
              {booleanos
                .filter((b) => !b.activo)
                .map((b) => (
                  <ItemMenu
                    key={b.clave}
                    onClick={() => {
                      onBooleano({ [b.clave]: true } as Partial<FiltrosVista>)
                      cerrar(false)
                    }}
                  >
                    {b.etiqueta}
                  </ItemMenu>
                ))}
            </>
          )}
        </PanelMenu>
      )}
    </>
  )
}

/** Vistas guardadas: nombre + query de la URL. */
function MenuVistas({
  consulta,
  onAplicar,
}: {
  consulta: string
  onAplicar: (consulta: string) => void
}) {
  const [vistas, setVistas] = useState<VistaGuardada[]>(() => leerVistas())
  const [nombrando, setNombrando] = useState(false)
  const [nombre, setNombre] = useState('')
  const { abierto, alternar, cerrar, disparadorRef, panelRef, posicion } = useMenuFlotante(() => {
    setNombrando(false)
    setNombre('')
  })

  const actual = vistas.find((v) => v.consulta === consulta)

  return (
    <>
      <button
        ref={disparadorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={alternar}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-borde bg-superficie',
          'px-2.5 text-sm font-medium whitespace-nowrap',
          'transition-colors duration-[var(--ms-instante)]',
          'hover:border-borde-fuerte hover:bg-superficie-2',
          (abierto || actual) && 'border-borde-fuerte bg-superficie-2',
        )}
      >
        <Bookmark
          aria-hidden
          className={cn('size-3.5', actual && 'fill-current text-[var(--acento)]')}
        />
        {actual ? actual.nombre : 'Vistas'}
      </button>

      {abierto && (
        <PanelMenu panelRef={panelRef} posicion={posicion} etiquetaAria="Vistas guardadas">
          {vistas.length > 0 && <TituloMenu>Mis vistas</TituloMenu>}

          {vistas.map((v) => (
            <div key={v.id} className="group flex items-center gap-1">
              <ItemMenu
                onClick={() => {
                  onAplicar(v.consulta)
                  cerrar(false)
                }}
                activo={v.consulta === consulta}
                icono={<Bookmark aria-hidden className="size-3.5" />}
                className="flex-1"
              >
                {v.nombre}
              </ItemMenu>
              <button
                type="button"
                aria-label={`Borrar la vista ${v.nombre}`}
                onClick={() => setVistas(borrarVista(v.id))}
                className="mr-1 rounded p-1 text-texto-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--error-fg)]"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </div>
          ))}

          {vistas.length > 0 && <SeparadorMenu />}

          {nombrando ? (
            <form
              className="flex items-center gap-1 p-1"
              onSubmit={(e) => {
                e.preventDefault()
                setVistas(guardarVista(nombre, consulta))
                cerrar(false)
              }}
            >
              <Entrada
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la vista"
                aria-label="Nombre de la vista"
                className="h-7"
              />
              <Boton type="submit" variante="primario" tamano="sm" disabled={!nombre.trim()}>
                Guardar
              </Boton>
            </form>
          ) : (
            <ItemMenu
              onClick={() => setNombrando(true)}
              icono={<BookmarkPlus aria-hidden className="size-3.5" />}
            >
              {consulta === '' ? 'Guardar vista (sin filtros)' : 'Guardar filtros actuales'}
            </ItemMenu>
          )}

          {vistas.length === 0 && !nombrando && (
            <p className="px-2 pb-2 text-xs leading-relaxed text-texto-3">
              Una vista guarda los filtros con un nombre. El enlace de la barra de direcciones
              también sirve para compartirla.
            </p>
          )}
        </PanelMenu>
      )}
    </>
  )
}
