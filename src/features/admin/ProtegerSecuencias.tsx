import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Aviso, Boton } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { completarPasos } from '@/data/repos/sitioProyectos'
import type { Actor } from '@/domain/tipos/comunes'

/**
 * Congela la secuencia de etapas de los seguimientos que se crearon antes de
 * que existiera el campo `pasos`. Hasta hacerlo, las reglas de esos sitios
 * validan los avances con un dato que quien avanza puede reescribir.
 *
 * Es una accion de una vez (volver a correrla solo toca lo que falte), por eso
 * vive aca y no escondida en un script.
 */
export function ProtegerSecuencias({ actor }: { actor: Actor }) {
  const [corriendo, setCorriendo] = useState(false)
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<{ revisados: number; completados: number } | null>(
    null,
  )

  const ejecutar = () => {
    setCorriendo(true)
    setAvance(null)
    completarPasos(actor, (hechos, total) => setAvance({ hechos, total }))
      .then((r) => {
        setResultado(r)
        avisar.ok(
          r.completados === 0
            ? 'Todas las secuencias ya estaban protegidas'
            : `Se protegió la secuencia de ${r.completados.toLocaleString('es-CL')} seguimiento(s)`,
        )
      })
      .catch((e) => avisar.error(`No se pudo completar: ${mensajeDeError(e)}`))
      .finally(() => setCorriendo(false))
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3 text-sm">
      <p className="text-texto-2">
        Cada seguimiento guarda su secuencia de etapas en un campo que solo un administrador puede
        cambiar, y así nadie puede saltarse etapas alterando el documento. Los seguimientos creados
        antes de este cambio no lo tienen: esta acción se lo agrega. Se puede correr las veces que
        quieras; solo toca los que falten.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Boton
          onClick={ejecutar}
          disabled={corriendo}
          icono={<ShieldCheck aria-hidden className="size-4" />}
        >
          {corriendo ? 'Protegiendo…' : 'Proteger secuencias'}
        </Boton>
        {corriendo && avance && (
          <span className="text-xs text-texto-3">
            {avance.hechos.toLocaleString('es-CL')} de {avance.total.toLocaleString('es-CL')}
          </span>
        )}
      </div>
      {resultado && !corriendo && (
        <Aviso tono="ok" titulo="Listo">
          Se revisaron {resultado.revisados.toLocaleString('es-CL')} seguimientos y se completaron{' '}
          {resultado.completados.toLocaleString('es-CL')}.
        </Aviso>
      )}
    </div>
  )
}
