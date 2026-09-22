import { Component, type ReactNode } from 'react'
import { Boton, EstadoVacio } from '@/components/ui'

/**
 * Si una pantalla revienta (o no se pudo descargar su trozo, tipicamente porque
 * hubo un despliegue con la pestana abierta), se muestra un aviso en su lugar
 * en vez de dejar toda la app en blanco. El menu y la navegacion siguen vivos.
 *
 * Quien lo usa le pone `key` con la ruta: al navegar a otra pantalla el limite
 * se reinicia solo.
 */
export class LimiteError extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error) {
    console.error('[pmo3000] Error en la pantalla', error)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <EstadoVacio
        titulo="No se pudo abrir esta pantalla"
        descripcion="Puede que haya una version nueva de la app o que se haya cortado la conexion. Recargar suele resolverlo."
        accion={<Boton onClick={() => window.location.reload()}>Recargar</Boton>}
      />
    )
  }
}
