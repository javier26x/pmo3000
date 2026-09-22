import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { observarSesion } from '@/data/autenticacion'
import { asegurarPerfil, observarUsuario } from '@/data/repos/usuarios'
import { mensajeDeError } from '@/app/avisos'
import type { Usuario } from '@/domain/tipos/usuario'
import type { Actor } from '@/domain/tipos/comunes'
import { puede, type Accion, type Recurso } from '@/domain/permisos/matriz'

interface ValorSesion {
  cargando: boolean
  autenticado: boolean
  email: string | null
  perfil: Usuario | null
  actor: Actor | null
  error: string | null
  /** Atajo: `puedeHacer('sitios', 'importar')`. */
  puedeHacer: (recurso: Recurso, accion: Accion) => boolean
}

const Contexto = createContext<ValorSesion | null>(null)

interface EstadoAuth {
  resuelto: boolean
  uid: string | null
  email: string | null
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<EstadoAuth>({ resuelto: false, uid: null, email: null })
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Todo el setState ocurre dentro del callback de la suscripcion, que es
    // exactamente para lo que existe un efecto: sincronizar con un sistema externo.
    return observarSesion((usuario) => {
      setAuth({ resuelto: true, uid: usuario?.uid ?? null, email: usuario?.email ?? null })
      if (!usuario) {
        setPerfil(null)
        setError(null)
        return
      }

      // El perfil se crea en el primer ingreso con rol 'lector'; promoverlo es
      // tarea de un administrador (y las reglas de Firestore lo exigen asi).
      asegurarPerfil({
        uid: usuario.uid,
        email: usuario.email ?? '',
        nombre: usuario.displayName ?? usuario.email ?? '',
      }).catch((e) => setError(mensajeDeError(e)))
    })
  }, [])

  useEffect(() => {
    const uid = auth.uid
    if (!uid) return
    return observarUsuario(uid, setPerfil, (e) => setError(mensajeDeError(e)))
  }, [auth.uid])

  const actor: Actor | null = useMemo(() => {
    if (!perfil) return null
    return {
      uid: perfil.id,
      email: perfil.email,
      nombre: perfil.nombre,
      rol: perfil.rol,
      celulaId: perfil.celulaId,
      proveedorId: perfil.proveedorId,
    }
  }, [perfil])

  const puedeHacer = useCallback(
    (recurso: Recurso, accion: Accion) => (perfil ? puede(perfil.rol, recurso, accion) : false),
    [perfil],
  )

  const valor: ValorSesion = useMemo(() => {
    // "Cargando" se DERIVA del estado en vez de mantenerse en su propia variable:
    // asi no hay que recordar apagarla en cada rama.
    const cargando = !auth.resuelto || (auth.uid !== null && perfil === null && error === null)
    return {
      cargando,
      autenticado: auth.uid !== null,
      email: auth.email,
      perfil,
      actor,
      error,
      puedeHacer,
    }
  }, [auth, perfil, actor, error, puedeHacer])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion')
  return valor
}

/** Version que exige sesion activa: para pantallas ya protegidas por la ruta. */
export function useActor(): Actor {
  const { actor } = useSesion()
  if (!actor) throw new Error('Esta pantalla requiere una sesion con perfil cargado')
  return actor
}
