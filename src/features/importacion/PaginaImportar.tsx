import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import {
  Aviso,
  BarraProgreso,
  Boton,
  CabeceraPantalla,
  Campo,
  Casilla,
  EnlaceBoton,
  Metrica,
  Selector,
  cn,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { usarPausaDespliegue } from '@/app/despliegue'
import { EXTENSIONES_ACEPTADAS, leerArchivoTabular, type ArchivoTabular } from '@/data/archivos'
import { idsExistentes } from '@/data/repos/sitios'
import {
  ejecutarImportacion,
  type DestinoPrograma,
  type ResultadoImportacion,
} from '@/data/repos/importacion'
import {
  CAMPOS_IMPORTACION,
  columnasIgnoradas,
  detectarMapeo,
  faltantesObligatorios,
  resumirImportacion,
  validarArchivo,
  type ClaveImportacion,
  type FilaImportacion,
  type Mapeo,
} from '@/domain/importacion'
import { NOMBRES_PRIORIDAD, PRIORIDADES, type Prioridad } from '@/domain/tipos/comunes'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { TablaPrevia } from './TablaPrevia'

type Paso = 'archivo' | 'mapeo' | 'previa' | 'resultado'

export default function PaginaImportar() {
  const actor = useActor()
  const pausar = usarPausaDespliegue((e) => e.pausar)
  const reanudar = usarPausaDespliegue((e) => e.reanudar)

  // Mientras se importa no hace falta escuchar el maestro completo: con miles de
  // sitios, cada lote confirmado dispararia una avalancha de actualizaciones en
  // los listeners y dejaria el navegador pegado.
  useEffect(() => {
    pausar()
    return reanudar
  }, [pausar, reanudar])

  const { programas, proyectos, proveedores, plantillaPorId } = useCatalogos()

  const [paso, setPaso] = useState<Paso>('archivo')
  const [archivo, setArchivo] = useState<ArchivoTabular | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [prioridad, setPrioridad] = useState<Prioridad>('media')
  const [proyectoPorDefecto, setProyectoPorDefecto] = useState('')
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [validando, setValidando] = useState(false)
  const [avance, setAvance] = useState<{ procesadas: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const entradaRef = useRef<HTMLInputElement>(null)

  const resumen = useMemo(() => resumirImportacion(filas), [filas])
  const faltantes = faltantesObligatorios(mapeo)
  const ignoradas = archivo ? columnasIgnoradas(archivo.cabeceras, mapeo) : []

  /** Programa (por nombre, en minusculas) -> destino al que se incorpora el sitio. */
  const destinos = useMemo(() => {
    const mapa = new Map<string, DestinoPrograma>()
    for (const programa of programas) {
      const proyecto = proyectos.find((p) => p.programaId === programa.id)
      const plantilla = plantillaPorId(programa.gateTemplateId)
      if (!proyecto || !plantilla) continue
      mapa.set(programa.nombre.trim().toLowerCase(), {
        programaId: programa.id,
        proyectoId: proyecto.id,
        portafolioId: programa.portafolioId,
        celulaId: proyecto.celulaId,
        plantilla,
      })
    }
    return mapa
  }, [programas, proyectos, plantillaPorId])

  const mapaProveedores = useMemo(
    () => new Map(proveedores.map((p) => [p.nombre.trim().toLowerCase(), p.id])),
    [proveedores],
  )

  const destinoPorDefecto = useMemo<DestinoPrograma | null>(() => {
    if (!proyectoPorDefecto) return null
    const proyecto = proyectos.find((p) => p.id === proyectoPorDefecto)
    if (!proyecto) return null
    const programa = programas.find((p) => p.id === proyecto.programaId)
    const plantilla = programa ? plantillaPorId(programa.gateTemplateId) : null
    if (!programa || !plantilla) return null
    return {
      programaId: programa.id,
      proyectoId: proyecto.id,
      portafolioId: programa.portafolioId,
      celulaId: proyecto.celulaId,
      plantilla,
    }
  }, [proyectoPorDefecto, proyectos, programas, plantillaPorId])

  const cargarArchivo = async (elegido: File, hoja?: string) => {
    setLeyendo(true)
    setErrorLectura(null)
    try {
      const leido = await leerArchivoTabular(elegido, hoja)
      setArchivo(leido)
      setMapeo(detectarMapeo(leido.cabeceras))
      setPaso('mapeo')
    } catch (e) {
      setErrorLectura(mensajeDeError(e))
    } finally {
      setLeyendo(false)
    }
  }

  const validar = async () => {
    if (!archivo) return
    setValidando(true)
    try {
      // Se leen los IDs del maestro para distinguir alta de actualizacion y
      // detectar duplicados antes de escribir nada.
      const existentes = await idsExistentes()
      setFilas(validarArchivo(archivo.filas, mapeo, existentes))
      setPaso('previa')
    } catch (e) {
      avisar.error(mensajeDeError(e))
    } finally {
      setValidando(false)
    }
  }

  const importar = async () => {
    setAvance({ procesadas: 0, total: resumen.importables })
    const salida = await ejecutarImportacion(
      filas,
      { destinos, proveedores: mapaProveedores, prioridad, destinoPorDefecto },
      actor,
      setAvance,
    )
    setResultado(salida)
    setAvance(null)
    setPaso('resultado')
    if (salida.error) avisar.error(salida.error)
    else avisar.ok(`${salida.sitiosEscritos} sitio(s) importado(s)`)
  }

  const reiniciar = () => {
    setArchivo(null)
    setMapeo({})
    setFilas([])
    setResultado(null)
    setPaso('archivo')
    if (entradaRef.current) entradaRef.current.value = ''
  }

  const pasos: { id: Paso; etiqueta: string }[] = [
    { id: 'archivo', etiqueta: 'Archivo' },
    { id: 'mapeo', etiqueta: 'Mapeo de columnas' },
    { id: 'previa', etiqueta: 'Vista previa' },
    { id: 'resultado', etiqueta: 'Resultado' },
  ]

  return (
    <>
      <CabeceraPantalla
        titulo="Importar maestro de sitios"
        descripcion="Excel o CSV. Nada se escribe hasta que confirmes la vista previa."
        acciones={
          paso !== 'archivo' && (
            <Boton onClick={reiniciar} icono={<RefreshCw aria-hidden className="size-4" />}>
              Empezar de nuevo
            </Boton>
          )
        }
      >
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {pasos.map((p, i) => {
            const indiceActual = pasos.findIndex((x) => x.id === paso)
            const estado = i < indiceActual ? 'hecho' : i === indiceActual ? 'actual' : 'pendiente'
            return (
              <li key={p.id} className="flex items-center gap-1">
                {i > 0 && (
                  <span aria-hidden className="text-texto-3">
                    /
                  </span>
                )}
                <span
                  aria-current={estado === 'actual' ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1 rounded px-1.5 py-0.5',
                    estado === 'actual' &&
                      'bg-[var(--acento-suave)] font-semibold text-[var(--acento)]',
                    estado === 'hecho' && 'text-[var(--ok-fg)]',
                    estado === 'pendiente' && 'text-texto-3',
                  )}
                >
                  {estado === 'hecho' && <Check aria-hidden className="size-3" />}
                  {p.etiqueta}
                </span>
              </li>
            )
          })}
        </ol>
      </CabeceraPantalla>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {/* ---------------------------------------------------------- paso 1 */}
        {paso === 'archivo' && (
          <div className="mx-auto max-w-2xl">
            <label
              htmlFor="archivo-import"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-borde-fuerte bg-superficie px-6 py-12 text-center hover:border-[var(--acento)] hover:bg-superficie-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const soltado = e.dataTransfer.files[0]
                if (soltado) void cargarArchivo(soltado)
              }}
            >
              <Upload aria-hidden className="size-8 text-texto-3" />
              <span className="text-md font-medium">
                {leyendo ? 'Leyendo el archivo…' : 'Arrastra la planilla o haz clic para elegirla'}
              </span>
              <span className="text-sm text-texto-2">
                Se aceptan .xlsx, .xlsm, .xls y .csv, hasta 25 MB. La primera fila debe ser la
                cabecera.
              </span>
              <input
                ref={entradaRef}
                id="archivo-import"
                type="file"
                accept={EXTENSIONES_ACEPTADAS}
                className="sr-only"
                onChange={(e) => {
                  const elegido = e.target.files?.[0]
                  if (elegido) void cargarArchivo(elegido)
                }}
              />
            </label>

            {errorLectura && (
              <Aviso tono="error" titulo="No pudimos leer el archivo" className="mt-3">
                {errorLectura}
              </Aviso>
            )}

            <Aviso tono="info" className="mt-3">
              El seed genera una planilla de prueba con 4.500 filas (y errores a proposito) en{' '}
              <code className="font-mono">datos-ejemplo/</code>: sirve para ver el importador a
              escala real.
            </Aviso>
          </div>
        )}

        {/* ---------------------------------------------------------- paso 2 */}
        {paso === 'mapeo' && archivo && (
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded border border-borde bg-superficie px-3 py-2">
              <FileSpreadsheet aria-hidden className="size-4 text-texto-3" />
              <span className="text-sm font-medium">{archivo.nombre}</span>
              <span className="text-xs text-texto-2">
                {archivo.filas.length.toLocaleString('es-CL')} filas · {archivo.cabeceras.length}{' '}
                columnas
              </span>
              {archivo.hojas.length > 1 && (
                <div className="ml-auto w-44">
                  <Selector
                    value={archivo.hoja ?? ''}
                    aria-label="Hoja del libro"
                    onChange={(e) => {
                      const elegido = entradaRef.current?.files?.[0]
                      if (elegido) void cargarArchivo(elegido, e.target.value)
                    }}
                  >
                    {archivo.hojas.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Selector>
                </div>
              )}
            </div>

            <section className="rounded border border-borde bg-superficie">
              <h2 className="border-b border-borde px-3 py-2 text-xs font-semibold text-texto-2">
                Mapeo de columnas
              </h2>
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {CAMPOS_IMPORTACION.map((campo) => (
                  <Campo
                    key={campo.clave}
                    etiqueta={campo.etiqueta}
                    htmlFor={`mapeo-${campo.clave}`}
                    obligatorio={campo.obligatorio}
                    ayuda={campo.ayuda}
                  >
                    <Selector
                      id={`mapeo-${campo.clave}`}
                      value={mapeo[campo.clave] ?? ''}
                      onChange={(e) =>
                        setMapeo((actual) => {
                          const copia = { ...actual }
                          if (e.target.value === '') delete copia[campo.clave as ClaveImportacion]
                          else copia[campo.clave as ClaveImportacion] = Number(e.target.value)
                          return copia
                        })
                      }
                      aria-invalid={campo.obligatorio && mapeo[campo.clave] === undefined}
                    >
                      <option value="">— sin asignar —</option>
                      {archivo.cabeceras.map((cabecera, i) => (
                        <option key={`${cabecera}-${i}`} value={i}>
                          {cabecera || `(columna ${i + 1})`}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                ))}
              </div>
            </section>

            <section className="rounded border border-borde bg-superficie p-3">
              <h2 className="mb-2 text-xs font-semibold text-texto-2">Destino del seguimiento</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo
                  etiqueta="Proyecto por defecto"
                  htmlFor="proyecto-defecto"
                  ayuda="Se usa solo en las filas que no traen columna Programa. Si lo dejas vacio, esas filas cargan el sitio al maestro sin seguimiento."
                >
                  <Selector
                    id="proyecto-defecto"
                    value={proyectoPorDefecto}
                    onChange={(e) => setProyectoPorDefecto(e.target.value)}
                  >
                    <option value="">— solo maestro, sin seguimiento —</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>

                <Campo
                  etiqueta="Prioridad inicial"
                  htmlFor="prioridad-import"
                  ayuda="Se aplica a los seguimientos que se creen en esta carga."
                >
                  <Selector
                    id="prioridad-import"
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {NOMBRES_PRIORIDAD[p]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </div>

              <p className="mt-2 text-xs text-texto-3">
                Los programas se reconocen por nombre exacto (sin distinguir mayusculas):{' '}
                {programas.map((p) => p.nombre).join(', ') || 'no hay programas creados'}.
              </p>
            </section>

            {faltantes.length > 0 && (
              <Aviso tono="riesgo" titulo="Falta mapear columnas obligatorias">
                {faltantes
                  .map((f) => CAMPOS_IMPORTACION.find((c) => c.clave === f)?.etiqueta)
                  .join(', ')}
              </Aviso>
            )}

            {ignoradas.length > 0 && (
              <Aviso tono="info" titulo="Columnas que se van a ignorar">
                {ignoradas.join(', ')}
              </Aviso>
            )}

            <div className="flex justify-end gap-2">
              <Boton onClick={reiniciar}>Cambiar archivo</Boton>
              <Boton
                variante="primario"
                disabled={faltantes.length > 0}
                cargando={validando}
                onClick={() => void validar()}
              >
                Validar y ver la vista previa
              </Boton>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- paso 3 */}
        {paso === 'previa' && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-borde bg-superficie px-3 py-2">
              <Metrica etiqueta="Filas" valor={resumen.total.toLocaleString('es-CL')} />
              <Metrica etiqueta="Nuevos" valor={resumen.nuevos.toLocaleString('es-CL')} tono="ok" />
              <Metrica etiqueta="Actualizan" valor={resumen.actualizan.toLocaleString('es-CL')} />
              <Metrica
                etiqueta="Duplicados"
                valor={resumen.duplicadosArchivo.toLocaleString('es-CL')}
                tono={resumen.duplicadosArchivo > 0 ? 'riesgo' : 'neutro'}
              />
              <Metrica
                etiqueta="Con error"
                valor={resumen.conError.toLocaleString('es-CL')}
                tono={resumen.conError > 0 ? 'error' : 'neutro'}
              />
              <Metrica
                etiqueta="Con aviso"
                valor={resumen.conAviso.toLocaleString('es-CL')}
                tono={resumen.conAviso > 0 ? 'riesgo' : 'neutro'}
              />
              <span className="flex-1" />
              <Casilla
                etiqueta={<span className="text-xs">Ver solo filas con problemas</span>}
                checked={soloProblemas}
                onChange={(e) => setSoloProblemas(e.target.checked)}
              />
            </div>

            {resumen.conError > 0 && (
              <Aviso tono="riesgo" titulo={`${resumen.conError} fila(s) no se van a importar`}>
                Se importan las {resumen.importables.toLocaleString('es-CL')} filas validas; las
                filas con error se omiten y quedan listadas aqui para que las corrijas en la
                planilla.
              </Aviso>
            )}

            <TablaPrevia filas={filas} soloProblemas={soloProblemas} />

            {avance && (
              <div className="rounded border border-borde bg-superficie p-3">
                <p className="mb-1 text-sm">
                  Escribiendo {avance.procesadas.toLocaleString('es-CL')} de{' '}
                  {avance.total.toLocaleString('es-CL')}…
                </p>
                <BarraProgreso
                  valor={avance.total === 0 ? 0 : (avance.procesadas / avance.total) * 100}
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Boton onClick={() => setPaso('mapeo')}>Volver al mapeo</Boton>
              <Boton
                variante="primario"
                disabled={resumen.importables === 0 || avance !== null}
                cargando={avance !== null}
                onClick={() => void importar()}
              >
                Importar {resumen.importables.toLocaleString('es-CL')} fila(s)
              </Boton>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- paso 4 */}
        {paso === 'resultado' && resultado && (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {resultado.error ? (
              <Aviso tono="error" titulo="La importacion se detuvo">
                {resultado.error}
                <p className="mt-1">
                  Lo ya escrito quedo guardado. Volver a correr la misma importacion es seguro: los
                  identificadores son deterministas, asi que no se duplica nada.
                </p>
              </Aviso>
            ) : (
              <Aviso tono="ok" titulo="Importacion terminada">
                Se escribieron {resultado.sitiosEscritos.toLocaleString('es-CL')} sitio(s) y se
                crearon o actualizaron {resultado.seguimientosCreados.toLocaleString('es-CL')}{' '}
                seguimiento(s).
              </Aviso>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-borde bg-superficie px-3 py-2">
              <Metrica etiqueta="Sitios escritos" valor={resultado.sitiosEscritos} tono="ok" />
              <Metrica etiqueta="Seguimientos" valor={resultado.seguimientosCreados} />
              <Metrica
                etiqueta="Filas omitidas"
                valor={resultado.filasOmitidas}
                tono={resultado.filasOmitidas > 0 ? 'riesgo' : 'neutro'}
              />
            </div>

            {resultado.programasNoEncontrados.length > 0 && (
              <Aviso tono="riesgo" titulo="Programas que no existen en la app">
                <p>
                  Estas filas cargaron el sitio al maestro pero no crearon seguimiento:{' '}
                  {resultado.programasNoEncontrados.join(', ')}.
                </p>
                <p className="mt-1">
                  Crea esos programas (o corrige el nombre en la planilla) y vuelve a importar.
                </p>
              </Aviso>
            )}

            {resultado.proveedoresNoEncontrados.length > 0 && (
              <Aviso tono="info" titulo="Proveedores que no existen en la app">
                {resultado.proveedoresNoEncontrados.join(', ')}. Los sitios quedaron sin proveedor
                asignado.
              </Aviso>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Boton onClick={reiniciar} icono={<Upload aria-hidden className="size-4" />}>
                Importar otro archivo
              </Boton>
              <EnlaceBoton to="/sitios" variante="primario">
                Ver el maestro
              </EnlaceBoton>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
