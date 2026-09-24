import type { TonoInsignia } from '@/components/ui'
import type { EstadoPrograma } from '@/domain/tipos'

export const TONO_ESTADO: Record<EstadoPrograma, TonoInsignia> = {
  planificado: 'info',
  en_curso: 'ok',
  en_riesgo: 'riesgo',
  cerrado: 'neutro',
}
