import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Boton, TAMANOS, VARIANTES } from './Boton'
import { EstadoVacio } from './estados'
import { cn } from './utilidades'

interface Props {
  children: ReactNode
  /** Se llama al reintentar. Lo usa el Layout para volver a montar la ruta. */
  alReintentar?: (() => void) | undefined
}

interface Estado {
  error: Error | null
}

/**
 * Atrapa los errores de render para que una pantalla rota no se lleve la app.
 *
 * Sin esto, cualquier excepcion durante el render deja el documento vacio: React
 * desmonta el arbol entero y la persona se queda mirando una pagina en blanco,
 * sin barra de navegacion y sin manera de volver. Pasa mas seguido de lo que
 * parece en esta app, porque buena parte del dato viene de planillas: un valor
 * con la forma equivocada en una columna del tracker basta.
 *
 * Solo atrapa errores de RENDER. Lo que falle dentro de un manejador de eventos
 * o en una promesa sigue yendo por avisar() (ver src/app/avisos.ts), que es lo
 * correcto: esos no dejan la pantalla inutilizable.
 */
export class LimiteError extends Component<Props, Estado> {
  override state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // La consola es el unico destino en Fase 1: no hay servicio de errores
    // montado. El componentStack es lo que dice en que pantalla se rompio.
    console.error('Error de render capturado por LimiteError', error, info.componentStack)
  }

  private reintentar = (): void => {
    this.setState({ error: null })
    this.props.alReintentar?.()
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <EstadoVacio
        icono={<TriangleAlert aria-hidden className="size-8" />}
        titulo="Se rompio esta pantalla"
        descripcion="El resto de la aplicacion sigue funcionando. Puedes reintentar o volver al inicio; si se repite, avisa a la PMO con el detalle de abajo."
        accion={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              <Boton onClick={this.reintentar} variante="primario">
                <RotateCcw aria-hidden className="size-4" />
                Reintentar
              </Boton>
              {/*
                Un <a> de verdad, no un <Link>: este componente tambien envuelve
                a los proveedores, donde todavia no hay Router y un Link tiraria
                su propio error dejando la pagina en blanco igual. Ademas, para
                salir de un estado roto conviene la recarga completa.
              */}
              <a
                href="/"
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap',
                  'transition-colors duration-100',
                  VARIANTES.secundario,
                  TAMANOS.md,
                )}
              >
                Volver al inicio
              </a>
            </div>

            {/* El mensaje crudo sirve para reportar, pero no deberia ser lo
                primero que se ve: va plegado. */}
            <details className="max-w-xl text-left">
              <summary className="cursor-pointer text-xs text-texto-3">Detalle tecnico</summary>
              <pre className="panel-scroll mt-2 max-h-40 overflow-auto rounded bg-superficie-2 p-2 text-left text-xs whitespace-pre-wrap text-texto-2">
                {error.message}
              </pre>
            </details>
          </div>
        }
      />
    )
  }
}
