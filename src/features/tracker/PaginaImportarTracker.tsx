import { useMemo, useState } from 'react'
import { FileSpreadsheet, Layers, Upload } from 'lucide-react'
import { leerHojaCruda, EXTENSIONES_ACEPTADAS, type ArchivoCrudo } from '@/data/archivos'
import { guardarPlantillaTracker, ejecutarImportacionTracker } from '@/data/repos/tracker'
import { inferirPlantilla, type PlantillaInferida } from '@/domain/tracker/inferencia'
import { construirPlantilla, convertirFila, indexarColumnas } from '@/domain/tracker/aplicacion'
import { coercionar, type TipoCampo } from '@/domain/tracker/campos'
import { resumirCalidad } from '@/domain/tracker/calidad'
import type { TipoEtapa } from '@/domain/gates/catalogo'
import { estaEnAlcance, tieneAlcance } from '@/domain/permisos/alcance'
import { puedeCorregirComoAdmin } from '@/domain/gates/maquina'
import { crearId } from '@/domain/tipos/identificadores'
import { mensajeDeError, usarAvisos } from '@/app/avisos'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { usarPausaDespliegue } from '@/app/despliegue'
import {
  Aviso,
  BarraProgreso,
  Boton,
  CabeceraPantalla,
  Campo,
  Cargando,
  Entrada,
  Insignia,
  Selector,
} from '@/components/ui'
import { RevisionPlantillaInferida } from './RevisionPlantilla'
import { PanelCalidadArchivo } from './CalidadArchivo'
import { EliminarSeguimientosProyecto } from './EliminarSeguimientosProyecto'

type Paso = 'archivo' | 'revisar' | 'importando' | 'listo'

interface Resumen {
  proyectoId: string
  /** La plantilla ya existia y quien importa no es admin: se reutilizo sin tocarla. */
  plantillaReutilizada: boolean
  sitios: number
  omitidas: number
  fueraDeOrden: number
  noVigentes: number
  enHold: number
  problemas: [string, number][]
}

export default function PaginaImportarTracker() {
  const actor = useActor()
  const esAdmin = puedeCorregirComoAdmin(actor)
  const { programas, proyectos, portafolios, proveedores } = useCatalogos()
  const mostrar = usarAvisos((e) => e.mostrar)
  const pausar = usarPausaDespliegue((e) => e.pausar)
  const reanudar = usarPausaDespliegue((e) => e.reanudar)

  const [paso, setPaso] = useState<Paso>('archivo')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [crudo, setCrudo] = useState<ArchivoCrudo | null>(null)
  const [propuesta, setPropuesta] = useState<PlantillaInferida | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [avance, setAvance] = useState({ procesadas: 0, total: 0 })
  const [resumen, setResumen] = useState<Resumen | null>(null)

  const [nombrePlantilla, setNombrePlantilla] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [proveedorId, setProveedorId] = useState('')

  // Un usuario acotado solo puede importar a proyectos de su alcance: las reglas
  // rechazarian cualquier otro. No se le ofrecen.
  const acotado = tieneAlcance(actor)
  const proyectosElegibles = acotado
    ? proyectos.filter((p) =>
        estaEnAlcance(actor, { celulaId: p.celulaId, programaId: p.programaId, proyectoId: p.id }),
      )
    : proyectos

  const proyecto = proyectosElegibles.find((p) => p.id === proyectoId) ?? null
  const programaDe = (id: string | null) => programas.find((p) => p.id === id) ?? null

  const filasDatos = useMemo(() => {
    if (crudo === null || propuesta === null) return []
    return crudo.filas
      .slice(propuesta.filaEncabezado + 1)
      .filter((f) => f.some((c) => c !== null && String(c).trim() !== ''))
  }, [crudo, propuesta])

  /**
   * Cambia el tipo propuesto para una columna.
   *
   * Existe porque el aviso de la propia pantalla dice "revisa el tipo o
   * importalas como texto", y sin esto esa instruccion no se podia cumplir. El
   * conteo de celdas que no calzan se recalcula en el momento: asi se ve si el
   * cambio resolvio el problema antes de escribir nada.
   */
  const cambiarTipo = (indiceColumna: number, tipo: TipoCampo) => {
    if (crudo === null || propuesta === null) return
    const valores = filasDatos.map((f) => f[indiceColumna] ?? null)
    const noConvertibles = valores.filter(
      (v) => v !== null && String(v).trim() !== '' && !coercionar(tipo, v).ok,
    ).length

    setPropuesta({
      ...propuesta,
      columnas: propuesta.columnas.map((c) =>
        c.indice === indiceColumna
          ? { ...c, campo: { ...c.campo, tipo, opciones: [] }, noConvertibles }
          : c,
      ),
    })
  }

  /** Cambia una etapa entre secuencial y paralela. */
  const cambiarTipoEtapa = (idEtapa: string, tipo: TipoEtapa) => {
    if (propuesta === null) return
    setPropuesta({
      ...propuesta,
      etapas: propuesta.etapas.map((e) => (e.id === idEtapa ? { ...e, tipo } : e)),
    })
  }

  // Se recalcula al cambiar la propuesta: pasar una etapa a paralela cambia en
  // que etapa queda cada sitio y, con eso, cuanto coincide con el Excel.
  const calidad = useMemo(() => {
    if (propuesta === null || filasDatos.length === 0) return null
    const indiceCalidad = indexarColumnas(propuesta)
    return resumirCalidad(filasDatos.map((f) => convertirFila(f, propuesta, indiceCalidad)))
  }, [propuesta, filasDatos])

  const cargar = async (f: File, hoja?: string) => {
    setLeyendo(true)
    setError(null)
    try {
      const leido = await leerHojaCruda(f, hoja)
      const inferida = inferirPlantilla(leido.filas)
      setArchivo(f)
      setCrudo(leido)
      setPropuesta(inferida)
      setNombrePlantilla(f.name.replace(/\.[^.]+$/, ''))
      setPaso('revisar')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setLeyendo(false)
    }
  }

  const importar = async () => {
    if (crudo === null || propuesta === null || proyecto === null) return
    const prog = programaDe(proyecto.programaId)
    if (prog === null) {
      setError('El proyecto elegido no tiene programa asociado.')
      return
    }
    const portafolioId =
      portafolios.find((p) => p.id === prog.portafolioId)?.id ?? prog.portafolioId

    setPaso('importando')
    setAvance({ procesadas: 0, total: filasDatos.length })
    // Las suscripciones en vivo se pausan: 1.400 sitios entrando de a lotes
    // dispararian un repintado por lote y dejarian la pantalla inservible.
    pausar()

    try {
      const plantilla = construirPlantilla(propuesta, {
        id: crearId(nombrePlantilla, 'tracker'),
        nombre: nombrePlantilla,
        descripcion: `Importada desde ${crudo.nombre}, hoja "${crudo.hoja}".`,
        version: 1,
        homologacion: {},
      })
      const estadoPlantilla = await guardarPlantillaTracker(plantilla as never, actor)

      const r = await ejecutarImportacionTracker(
        filasDatos,
        propuesta,
        {
          programaId: prog.id,
          proyectoId: proyecto.id,
          portafolioId,
          celulaId: proyecto.celulaId,
          proveedorId: proveedorId === '' ? null : proveedorId,
          plantillaId: plantilla.id,
          plantillaVersion: 1,
          prioridad: 'media',
        },
        actor,
        {},
        setAvance,
      )

      if (r.error !== null) {
        setError(r.error)
        mostrar('error', `La importación se detuvo: ${r.error}`)
      } else {
        mostrar('ok', `${r.seguimientosEscritos} sitios importados.`)
      }
      setResumen({
        proyectoId: proyecto.id,
        plantillaReutilizada: estadoPlantilla === 'existente',
        sitios: r.seguimientosEscritos,
        omitidas: r.filasOmitidas,
        fueraDeOrden: r.fueraDeOrden,
        noVigentes: r.noVigentes,
        enHold: r.enHold,
        problemas: [...r.problemas].sort((a, b) => b[1] - a[1]),
      })
      setPaso('listo')
    } catch (e) {
      setError(mensajeDeError(e))
      setPaso('revisar')
    } finally {
      reanudar()
    }
  }

  const indice = propuesta === null ? null : indexarColumnas(propuesta)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CabeceraPantalla
        titulo="Importar un tracker"
        descripcion="Sube la planilla del proyecto y la app deduce sus etapas, sus revisiones por disciplina y sus columnas. Revisas la propuesta antes de que se escriba nada."
      />

      <div className="panel-scroll min-h-0 flex-1 overflow-auto p-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {error !== null && (
            <Aviso tono="error" titulo="No se pudo continuar">
              {error}
            </Aviso>
          )}

          {paso === 'archivo' && (
            <div className="rounded-lg border border-borde bg-superficie p-6 text-center">
              <FileSpreadsheet aria-hidden className="mx-auto mb-3 size-8 text-texto-3" />
              <h2 className="mb-1 text-md">Elige la planilla del tracker</h2>
              <p className="mx-auto mb-4 max-w-md text-sm text-texto-2">
                Excel o CSV, hasta 25 MB. Si el libro trae varias hojas se elige la más grande, y
                puedes cambiarla después. Las filas de contadores que suelen ir sobre el encabezado
                se detectan solas.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-[var(--acento)] px-3 py-2 text-sm font-medium text-[var(--acento-texto)] hover:bg-[var(--acento-hover)]">
                <Upload aria-hidden className="size-4" />
                Elegir archivo
                <input
                  type="file"
                  className="sr-only"
                  accept={EXTENSIONES_ACEPTADAS}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void cargar(f)
                  }}
                />
              </label>
              {leyendo && <Cargando texto="Leyendo la planilla…" className="mt-4" />}
            </div>
          )}

          {paso === 'revisar' && propuesta !== null && crudo !== null && indice !== null && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm">
                <FileSpreadsheet aria-hidden className="size-4 text-texto-3" />
                <span className="font-medium">{crudo.nombre}</span>
                {crudo.hojas.length > 1 && (
                  <label className="flex items-center gap-1.5 text-xs text-texto-2">
                    Hoja
                    <Selector
                      value={crudo.hoja}
                      className="w-auto"
                      onChange={(e) => archivo && void cargar(archivo, e.target.value)}
                    >
                      {crudo.hojas.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Selector>
                  </label>
                )}
                <Insignia tono="neutro">{filasDatos.length} filas</Insignia>
                <Insignia tono="neutro">{propuesta.etapas.length} etapas</Insignia>
                <Insignia tono="neutro">{propuesta.columnas.length} columnas</Insignia>
                <span className="text-xs text-texto-3">
                  encabezado en la fila {propuesta.filaEncabezado + 1}
                </span>
              </div>

              <RevisionPlantillaInferida
                propuesta={propuesta}
                indice={indice}
                onCambiarTipo={cambiarTipo}
                onCambiarTipoEtapa={cambiarTipoEtapa}
              />

              {calidad !== null && <PanelCalidadArchivo calidad={calidad} />}

              <div className="rounded-lg border border-borde bg-superficie p-3">
                <h3 className="mb-3 flex items-center gap-2 text-md">
                  <Layers aria-hidden className="size-4 text-texto-3" />
                  Dónde se guarda
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo etiqueta="Nombre de la plantilla" htmlFor="nom" obligatorio>
                    <Entrada
                      id="nom"
                      value={nombrePlantilla}
                      onChange={(e) => setNombrePlantilla(e.target.value)}
                    />
                  </Campo>
                  <Campo
                    etiqueta="Proyecto"
                    htmlFor="proy"
                    obligatorio
                    ayuda={
                      proyectosElegibles.length === 0
                        ? acotado
                          ? 'Ningún proyecto de tu alcance'
                          : 'Créalo en Configuración'
                        : acotado
                          ? 'Solo los proyectos de tu alcance'
                          : undefined
                    }
                  >
                    <Selector
                      id="proy"
                      value={proyectoId}
                      onChange={(e) => setProyectoId(e.target.value)}
                    >
                      <option value="">Elige un proyecto…</option>
                      {proyectosElegibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Proveedor" htmlFor="prov" ayuda="Opcional, para todo el lote">
                    <Selector
                      id="prov"
                      value={proveedorId}
                      onChange={(e) => setProveedorId(e.target.value)}
                    >
                      <option value="">Sin proveedor</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                </div>

                {!esAdmin && (
                  <Aviso tono="info" className="mt-3">
                    Las plantillas las crea un administrador. Si ya existe una plantilla con este
                    nombre (porque el tracker ya se importó antes) se reutiliza tal cual; si no
                    existe, la importación se detiene antes de escribir nada. Además, al re-importar
                    solo puedes mover cada sitio una etapa: los saltos mayores los re-importa un
                    administrador.
                  </Aviso>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Boton
                    variante="primario"
                    disabled={proyectoId === '' || nombrePlantilla.trim() === ''}
                    onClick={() => void importar()}
                  >
                    Importar {filasDatos.length} sitios
                  </Boton>
                  <Boton variante="secundario" onClick={() => setPaso('archivo')}>
                    Usar otro archivo
                  </Boton>
                </div>
              </div>
            </>
          )}

          {paso === 'importando' && (
            <div className="rounded-lg border border-borde bg-superficie p-6">
              <p className="mb-2 text-sm">
                Escribiendo {avance.procesadas} de {avance.total}…
              </p>
              <BarraProgreso valor={(avance.procesadas / Math.max(avance.total, 1)) * 100} />
              <p className="mt-2 text-xs text-texto-3">
                No cierres la pestaña. Si algo falla, volver a importar el mismo archivo es seguro:
                los identificadores son los del tracker, así que se actualiza en vez de duplicarse.
              </p>
            </div>
          )}

          {paso === 'listo' && resumen !== null && (
            <div className="flex flex-col gap-3">
              <Aviso tono={resumen.sitios > 0 ? 'ok' : 'riesgo'} titulo="Importación terminada">
                {resumen.sitios} sitios guardados
                {resumen.omitidas > 0 && `, ${resumen.omitidas} filas omitidas por no traer ID`}.
              </Aviso>

              {resumen.plantillaReutilizada && (
                <Aviso tono="info" titulo="Se usó la plantilla existente">
                  La plantilla ya existía y solo un administrador puede modificarla, así que se
                  reutilizó sin cambios. Si el tracker trae etapas o columnas nuevas, pide a un
                  administrador que lo re-importe.
                </Aviso>
              )}

              {(resumen.noVigentes > 0 || resumen.enHold > 0) && (
                <Aviso tono="info" titulo="Vigencia y On Hold">
                  {resumen.noVigentes > 0 &&
                    `${resumen.noVigentes} sitios quedaron como no vigentes: no aparecen en la lista de sitios salvo que cambies el filtro de vigencia. `}
                  {resumen.enHold > 0 &&
                    `${resumen.enHold} sitios quedaron bloqueados porque el tracker los marca On Hold.`}
                </Aviso>
              )}

              {resumen.fueraDeOrden > 0 && (
                <Aviso tono="riesgo" titulo="Avance fuera de orden">
                  {resumen.fueraDeOrden} sitios tienen etapas secuenciales aprobadas{' '}
                  <em>después</em> de la que los tiene frenados. No es un problema de la
                  importación: es lo que dice el tracker, y casi siempre significa que una celda
                  quedó sin actualizar.
                </Aviso>
              )}

              {resumen.problemas.length > 0 && (
                <div className="rounded-lg border border-borde bg-superficie p-3">
                  <h3 className="mb-1 text-md">Celdas que no calzaron con su tipo</h3>
                  <p className="mb-2 text-xs text-texto-2">
                    Se importó todo lo demás. Si una columna aparece muchas veces, probablemente
                    convenga tratarla como texto.
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {resumen.problemas.slice(0, 12).map(([columna, n]) => (
                      <li key={columna} className="flex items-center justify-between gap-2">
                        <span className="truncate">{columna}</span>
                        <Insignia tono="riesgo">{n}</Insignia>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Boton variante="primario" onClick={() => setPaso('archivo')}>
                  Importar otro tracker
                </Boton>
              </div>
            </div>
          )}

          {(paso === 'archivo' || paso === 'listo') && (
            <EliminarSeguimientosProyecto
              {...(paso === 'listo' && resumen !== null
                ? { proyectoInicial: resumen.proyectoId }
                : {})}
            />
          )}
        </div>
      </div>
    </div>
  )
}
