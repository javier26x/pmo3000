import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { Rutas } from './app/rutas'
import { LimiteError, Notificaciones } from './components/ui'
import { ProveedorSesion } from './hooks/useSesion'

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
