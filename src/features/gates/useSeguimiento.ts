import { useCallback } from 'react'
import { observarSeguimiento } from '@/data/repos/sitioProyectos'
import { observarHistorial } from '@/data/repos/auditoria'
import { observarComentarios } from '@/data/repos/sitioProyectos'
import { useSuscripcion } from '@/hooks/useSuscripcion'
import type { SitioProyecto } from '@/domain/tipos/sitioProyecto'
import type { EventoAuditoria } from '@/domain/tipos/auditoria'
import type { Comentario } from '@/data/normalizadores'

const SIN_EVENTOS: EventoAuditoria[] = []
const SIN_COMENTARIOS: Comentario[] = []

export function useSeguimiento(id: string | undefined) {
  const suscribir = useCallback(
    (cb: (d: SitioProyecto | null) => void, onError: (e: Error) => void) => {
      if (!id) return () => {}
      return observarSeguimiento(id, cb, onError)
    },
    [id],
  )
  return useSuscripcion<SitioProyecto | null>(id ? suscribir : null, null)
}

export function useHistorial(entidadId: string | undefined) {
  const suscribir = useCallback(
    (cb: (d: EventoAuditoria[]) => void, onError: (e: Error) => void) => {
      if (!entidadId) return () => {}
      return observarHistorial(entidadId, cb, onError)
    },
    [entidadId],
  )
  return useSuscripcion(entidadId ? suscribir : null, SIN_EVENTOS)
}

export function useComentarios(seguimientoId: string | undefined) {
  const suscribir = useCallback(
    (cb: (d: Comentario[]) => void, onError: (e: Error) => void) => {
      if (!seguimientoId) return () => {}
      return observarComentarios(seguimientoId, cb, onError)
    },
    [seguimientoId],
  )
  return useSuscripcion(seguimientoId ? suscribir : null, SIN_COMENTARIOS)
}
