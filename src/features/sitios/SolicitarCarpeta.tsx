import { useCallback, useMemo, useState } from 'react'
import { MailPlus } from 'lucide-react'
import { Aviso, Boton, Selector } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { observarConfigCarpetas, type ConfigCarpetas } from '@/data/repos/config'
import { actualizarCarpeta } from '@/data/repos/sitios'
import {
  crearServicioCarpetas,
  observarSolicitudesDeSitio,
  type SolicitudRegistrada,
} from '@/data/microsoft'
import { PLANTILLA_ASUNTO_POR_DEFECTO } from '@/domain/carpetas'
import { formatearFecha, formatearFechaHora, hoyEnChile } from '@/domain/fechas'
import type { Actor } from '@/domain/tipos/comunes'
import type { Sitio } from '@/domain/tipos/sitio'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useSuscripcion } from '@/hooks/useSuscripcion'

const CONFIG_INICIAL: ConfigCarpetas = {
  buzonCarpetas: null,
  asuntoCarpeta: PLANTILLA_ASUNTO_POR_DEFECTO,
}
const SIN_SOLICITUDES: SolicitudRegistrada[] = []

/**
 * Pedir la carpeta de SharePoint de un sitio. Hoy prepara el correo para Power
 * Automate; con Graph, el mismo boton la crearia directo (ver
 * src/data/microsoft/carpetas.ts). La pantalla maneja los dos resultados.
 */
export function SolicitarCarpeta({
  sitio,
  participaciones,
  actor,
}: {
  sitio: Sitio
  participaciones: readonly SitioProyecto[]
  actor: Actor
}) {
  const { nombrePrograma, nombreProyecto, nombreUsuario } = useCatalogos()
  const [programaId, setProgramaId] = useState('')
  const [preparando, setPreparando] = useState(false)

  const { datos: config } = useSuscripcion(observarConfigCarpetas, CONFIG_INICIAL)
  const suscribirSolicitudes = useCallback(
    (cb: (l: SolicitudRegistrada[]) => void, onError: (e: Error) => void) =>
      observarSolicitudesDeSitio(sitio.id, cb, onError),
    [sitio.id],
  )
  const { datos: solicitudes } = useSuscripcion(suscribirSolicitudes, SIN_SOLICITUDES)

  const servicio = useMemo(() => crearServicioCarpetas(config), [config])
  const estado = servicio.disponible()

  // La carpeta cuelga del programa: si el sitio esta en varios, se elige.
  const programas = useMemo(() => {
    const vistos = new Map<string, SitioProyecto>()
    for (const sp of participaciones) if (!vistos.has(sp.programaId)) vistos.set(sp.programaId, sp)
    return [...vistos.values()]
  }, [participaciones])
  const elegido = programas.find((sp) => sp.programaId === programaId) ?? programas[0] ?? null
  const ultima = solicitudes[0] ?? null

  const preparar = () => {
    if (!elegido) return
    setPreparando(true)
    servicio
      .solicitar(
        {
          sitioId: sitio.id,
          programaId: elegido.programaId,
          datos: {
            programa: nombrePrograma(elegido.programaId),
            proyecto: nombreProyecto(elegido.proyectoId),
            sitioId: sitio.id,
            nombre: sitio.nombre,
            comuna: sitio.comuna,
            region: sitio.region,
            solicitante: { nombre: actor.nombre, email: actor.email },
            fecha: formatearFecha(hoyEnChile()),
          },
        },
        actor,
      )
      .then(async (r) => {
        if (r.via === 'correo') {
          window.location.href = r.mailto
          avisar.ok('Se abrió tu correo con la solicitud lista: solo envíala.')
        } else {
          await actualizarCarpeta(sitio, r.url, actor)
          avisar.ok('Carpeta creada')
        }
      })
      .catch((e) => avisar.error(`No se pudo preparar la solicitud: ${mensajeDeError(e)}`))
      .finally(() => setPreparando(false))
  }

  if (programas.length === 0) {
    return (
      <p className="text-xs text-texto-3">
        El sitio no está en ningún programa: la carpeta se pide cuando se incorpore a uno.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!estado.ok ? (
        <Aviso tono="info">{estado.motivo}</Aviso>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {programas.length > 1 && (
            <div className="w-56 max-w-full">
              <Selector
                aria-label="Programa de la carpeta"
                value={elegido?.programaId ?? ''}
                onChange={(e) => setProgramaId(e.target.value)}
                className="h-8 text-xs"
              >
                {programas.map((sp) => (
                  <option key={sp.programaId} value={sp.programaId}>
                    {nombrePrograma(sp.programaId)}
                  </option>
                ))}
              </Selector>
            </div>
          )}
          <Boton
            tamano="sm"
            onClick={preparar}
            cargando={preparando}
            icono={<MailPlus aria-hidden className="size-3.5" />}
          >
            Preparar correo de carpeta
          </Boton>
        </div>
      )}
      {ultima && (
        <p className="text-xs text-texto-3">
          Última solicitud: {formatearFechaHora(ultima.generadoEn)}, por{' '}
          {nombreUsuario(ultima.generadoPor)}. Cuando Power Automate responda, pega la URL abajo.
        </p>
      )}
    </div>
  )
}
