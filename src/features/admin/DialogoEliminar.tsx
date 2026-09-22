import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Aviso, Boton, Cargando, Dialogo } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import {
  describirReferencias,
  totalReferencias,
  type ConteoReferencias,
} from '@/domain/catalogos/referencias'

export type ResultadoEliminar =
  { eliminado: true } | { eliminado: false; referencias: ConteoReferencias }

export interface Alternativa {
  etiqueta: string
  explicacion: string
  ejecutar: () => void
}

type Estado =
  | { fase: 'verificando' }
  | { fase: 'libre' }
  | { fase: 'en_uso'; referencias: ConteoReferencias }
  | { fase: 'error'; mensaje: string }

/**
 * Confirmacion de borrado que primero pregunta quien usa el documento.
 *
 * Si nadie lo usa, ofrece eliminar. Si algo lo usa, no ofrece eliminar: explica
 * que lo usa y ofrece la alternativa segura (desactivar o cerrar), que conserva
 * el historial. Se monta al abrir y se desmonta al cerrar, asi cada apertura
 * vuelve a contar desde cero.
 */
export function DialogoEliminar({
  titulo,
  nombre,
  queEs,
  etiquetaEliminar,
  verificar,
  eliminar,
  alternativa: alternativaBase,
  sinAlternativa = 'Ya está desactivado. Para eliminarlo, primero reasigna o elimina lo que lo usa.',
  onCerrar,
  onEliminado,
}: {
  /** "Eliminar programa". */
  titulo: string
  nombre: string
  /** "el programa", "la célula": para armar las frases. */
  queEs: string
  etiquetaEliminar: string
  verificar: () => Promise<ConteoReferencias>
  eliminar: () => Promise<ResultadoEliminar>
  /**
   * Desactivar o cerrar. null si ya esta desactivado. Puede depender de quien lo
   * usa: una plantilla con sitios en seguimiento, por ejemplo, no se desactiva.
   */
  alternativa: Alternativa | null | ((referencias: ConteoReferencias) => Alternativa | null)
  /** Que decir cuando no hay alternativa. */
  sinAlternativa?: string
  onCerrar: () => void
  onEliminado?: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' })
  const [eliminando, setEliminando] = useState(false)
  const alternativa =
    estado.fase !== 'en_uso'
      ? null
      : typeof alternativaBase === 'function'
        ? alternativaBase(estado.referencias)
        : alternativaBase

  useEffect(() => {
    let vigente = true
    verificar()
      .then((referencias) => {
        if (!vigente) return
        setEstado(
          totalReferencias(referencias) > 0 ? { fase: 'en_uso', referencias } : { fase: 'libre' },
        )
      })
      .catch((e) => {
        if (!vigente) return
        setEstado({
          fase: 'error',
          mensaje: `No pudimos comprobar si ${queEs} está en uso (${mensajeDeError(e)}). Revisa tu conexión y vuelve a abrir este diálogo: sin esa comprobación no se puede eliminar.`,
        })
      })
    return () => {
      vigente = false
    }
    // Se verifica una sola vez por apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmar = () => {
    setEliminando(true)
    eliminar()
      .then((r) => {
        if (r.eliminado) {
          avisar.ok(`Se eliminó «${nombre}»`)
          onCerrar()
          onEliminado?.()
        } else {
          // Alguien lo empezo a usar mientras el dialogo estaba abierto.
          setEstado({ fase: 'en_uso', referencias: r.referencias })
        }
      })
      .catch((e) => setEstado({ fase: 'error', mensaje: mensajeDeError(e) }))
      .finally(() => setEliminando(false))
  }

  return (
    <Dialogo
      abierto
      ancho="sm"
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={nombre}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          {estado.fase === 'en_uso' && alternativa && (
            <Boton
              variante="primario"
              onClick={() => {
                alternativa.ejecutar()
                onCerrar()
              }}
            >
              {alternativa.etiqueta}
            </Boton>
          )}
          {estado.fase === 'libre' && (
            <Boton
              variante="peligro"
              cargando={eliminando}
              onClick={confirmar}
              icono={<Trash2 aria-hidden className="size-4" />}
            >
              {etiquetaEliminar}
            </Boton>
          )}
        </>
      }
    >
      {estado.fase === 'verificando' && <Cargando texto="Comprobando si está en uso…" />}

      {estado.fase === 'libre' && (
        <p className="text-sm">
          Nada usa {queEs} «{nombre}», así que se puede eliminar. Esta acción no se puede deshacer,
          pero queda registrada en la auditoría.
        </p>
      )}

      {estado.fase === 'en_uso' && (
        <div className="flex flex-col gap-2">
          <Aviso tono="riesgo" titulo="No se puede eliminar porque está en uso">
            Lo usan {describirReferencias(estado.referencias)}. Si se borrara, esos registros
            quedarían apuntando a algo que ya no existe.
          </Aviso>
          <p className="text-xs text-texto-2">
            {alternativa ? alternativa.explicacion : sinAlternativa}
          </p>
        </div>
      )}

      {estado.fase === 'error' && <Aviso tono="error">{estado.mensaje}</Aviso>}
    </Dialogo>
  )
}
