import { useEffect, useState } from 'react'
import { observarConexion, type InformeConexion } from '@/data/conexion'
import { useSesion } from './useSesion'

const INICIAL: InformeConexion = { estado: 'conectado', cambiosPendientes: false }

/** Estado de la conexion con Firestore, para avisar al usuario en terreno. */
export function useConexion(): InformeConexion {
  const { autenticado } = useSesion()
  const [informe, setInforme] = useState<InformeConexion>(INICIAL)

  useEffect(() => {
    if (!autenticado) return
    return observarConexion(setInforme)
  }, [autenticado])

  return informe
}
