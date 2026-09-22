import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { Rutas } from './app/rutas'
import { Notificaciones } from './components/ui'
import { ProveedorSesion } from './hooks/useSesion'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontro el elemento #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <ProveedorSesion>
      <Rutas />
      <Notificaciones />
    </ProveedorSesion>
  </StrictMode>,
)
