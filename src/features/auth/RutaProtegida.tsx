import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AlertTriangle, ShieldOff } from 'lucide-react'
import { Aviso, Boton, Cargando, EstadoVacio } from '@/components/ui'
import { cerrarSesion } from '@/features/auth/servicio'
import { useSesion } from '@/hooks/useSesion'
import { puede, type Accion, type Recurso } from '@/domain/permisos/matriz'

export function RutaProtegida({
  children,
  requiere,
}: {
  children: ReactNode
  requiere?: [Recurso, Accion]
}) {
  const { cargando, autenticado, perfil, error } = useSesion()
  const ubicacion = useLocation()

  if (cargando) return <Cargando texto="Cargando tu sesion…" />

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  }

  if (error && !perfil) {
    return (
      <div className="p-4">
        <Aviso tono="error" titulo="No pudimos cargar tu perfil">
          {error}
        </Aviso>
      </div>
    )
  }

  if (!perfil) return <Cargando texto="Preparando tu perfil…" />

  if (!perfil.activo) {
    return (
      <EstadoVacio
        icono={<ShieldOff aria-hidden className="size-8" />}
        titulo="Tu cuenta esta desactivada"
        descripcion="Un administrador de la PMO tiene que reactivarla para que puedas entrar."
        accion={<Boton onClick={() => void cerrarSesion()}>Cerrar sesion</Boton>}
      />
    )
  }

  if (requiere && !puede(perfil.rol, requiere[0], requiere[1])) {
    return (
      <EstadoVacio
        icono={<AlertTriangle aria-hidden className="size-8" />}
        titulo="No tienes acceso a esta pantalla"
        descripcion={`Tu rol actual no permite ${requiere[1]} sobre ${requiere[0]}. Si lo necesitas, pide a un administrador que ajuste tu rol.`}
      />
    )
  }

  return <>{children}</>
}
