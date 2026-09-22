import { useState } from 'react'
import { Aviso, Boton, Campo, Entrada } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import {
  guardarConfigCarpetas,
  observarConfigCarpetas,
  type ConfigCarpetas,
} from '@/data/repos/config'
import { PLANTILLA_ASUNTO_POR_DEFECTO, asuntoCarpeta, asuntoValido } from '@/domain/carpetas'
import { esEmailValido } from '@/domain/permisos/dominio'
import type { Actor } from '@/domain/tipos/comunes'
import { useSuscripcion } from '@/hooks/useSuscripcion'

const INICIAL: ConfigCarpetas = { buzonCarpetas: null, asuntoCarpeta: PLANTILLA_ASUNTO_POR_DEFECTO }

/** Asi se ve el asunto con datos de ejemplo: detecta una plantilla rota antes de guardar. */
const EJEMPLO = {
  programa: 'Plan 200 sitios nuevos',
  proyecto: 'Plan 200 - Metropolitana',
  sitioId: 'RM-0421',
  nombre: 'Cerro Azul 43',
  comuna: '',
  region: '',
  solicitante: { nombre: '', email: '' },
  fecha: '',
}

/**
 * El buzon que lee el flujo de Power Automate y la plantilla del asunto. Se
 * editan aca para que un cambio en el flujo no requiera tocar codigo.
 */
export function ConfigCarpetasSharePoint({ actor }: { actor: Actor }) {
  const { datos: config, cargando } = useSuscripcion(observarConfigCarpetas, INICIAL)
  const [buzon, setBuzon] = useState<string | null>(null)
  const [plantilla, setPlantilla] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const valorBuzon = buzon ?? config.buzonCarpetas ?? ''
  const valorPlantilla = plantilla ?? config.asuntoCarpeta
  const ejemplo = asuntoCarpeta(valorPlantilla, EJEMPLO)
  const plantillaOk = asuntoValido(ejemplo)
  const buzonOk = valorBuzon.trim() === '' || esEmailValido(valorBuzon)
  const cambio = buzon !== null || plantilla !== null

  const guardar = () => {
    setGuardando(true)
    guardarConfigCarpetas(
      { buzonCarpetas: valorBuzon.trim() || null, asuntoCarpeta: valorPlantilla.trim() },
      actor,
    )
      .then(() => {
        avisar.ok('Configuración de carpetas guardada')
        setBuzon(null)
        setPlantilla(null)
      })
      .catch((e) => avisar.error(mensajeDeError(e)))
      .finally(() => setGuardando(false))
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Buzón de Power Automate"
          htmlFor="cfg-buzon"
          ayuda="Adonde van las solicitudes. Mejor un buzón compartido, ej. pmo.carpetas@clarovtr.cl."
          {...(!buzonOk ? { error: 'Ese correo no parece válido.' } : {})}
        >
          <Entrada
            id="cfg-buzon"
            type="email"
            placeholder="pmo.carpetas@clarovtr.cl"
            value={valorBuzon}
            disabled={cargando}
            onChange={(e) => setBuzon(e.target.value)}
          />
        </Campo>
        <Campo
          etiqueta="Plantilla del asunto"
          htmlFor="cfg-asunto"
          ayuda="Usa {programa}, {sitioId}, {nombre} y {proyecto}. Tiene que dar 4 partes separadas por « | »."
          {...(!plantillaOk ? { error: 'No produce el formato que lee el flujo.' } : {})}
        >
          <Entrada
            id="cfg-asunto"
            value={valorPlantilla}
            disabled={cargando}
            onChange={(e) => setPlantilla(e.target.value)}
          />
        </Campo>
      </div>
      <p className="text-xs text-texto-3">
        Ejemplo: <span className="font-mono">{ejemplo}</span>
      </p>
      {!config.buzonCarpetas && !cargando && (
        <Aviso tono="info">
          Mientras no haya buzón, la ficha del sitio no ofrece «Preparar correo de carpeta». El
          flujo se arma siguiendo docs/power-automate-carpetas.md.
        </Aviso>
      )}
      <div>
        <Boton
          variante="primario"
          tamano="sm"
          onClick={guardar}
          cargando={guardando}
          disabled={!cambio || !buzonOk || !plantillaOk}
        >
          Guardar
        </Boton>
      </div>
    </div>
  )
}
