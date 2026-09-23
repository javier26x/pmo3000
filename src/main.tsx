import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { Rutas } from './app/rutas'
import { LimiteError, Notificaciones } from './components/ui'
import { ProveedorSesion } from './hooks/useSesion'

// Tras un despliegue, una pestana abierta pide trozos con nombres que ya no
// existen. Recargar trae la version nueva; la marca evita un ciclo de recargas
// si el problema es otro (por ejemplo, sin red).
window.addEventListener('vite:preloadError', (evento) => {
  try {
    if (sessionStorage.getItem('pmo3000.recargaPorVersion') === '1') return
    sessionStorage.setItem('pmo3000.recargaPorVersion', '1')
  } catch {
    return
  }
  evento.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  // Si la pagina llego a cargar, la proxima falla puede volver a recargar.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem('pmo3000.recargaPorVersion')
    } catch {
      // sin almacenamiento no hay marca que limpiar
    }
  }, 10_000)
})

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontro el elemento #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    {/*
      Segundo limite, por fuera de los proveedores. El del Layout cubre las
      pantallas; este cubre lo que pasa antes de que exista un Layout que
      mostrar (sesion, catalogos, el router mismo). Sin el, un error ahi sigue
      dejando la pagina en blanco.
    */}
    <LimiteError>
      <ProveedorSesion>
        <Rutas />
        <Notificaciones />
      </ProveedorSesion>
    </LimiteError>
  </StrictMode>,
)
