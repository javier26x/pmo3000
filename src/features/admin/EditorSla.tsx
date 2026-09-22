import { useMemo, useState } from 'react'
import { Aviso, Boton, Casilla, Dialogo, Entrada } from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { guardarSlaProyecto } from '@/data/repos/catalogos'
import { esParalela } from '@/domain/gates/catalogo'
import type { Celula, GateTemplate, Programa, Proyecto } from '@/domain/tipos'
import type { Actor } from '@/domain/tipos/comunes'
import { useDespliegue } from '@/hooks/useDespliegue'

type Tabla = Record<string, string>

const aTexto = (dias: Record<string, number> | undefined): Tabla =>
  Object.fromEntries(Object.entries(dias ?? {}).map(([k, v]) => [k, String(v)]))

/** Solo enteros positivos; lo vacio o invalido es "sin plazo". */
function aDias(tabla: Tabla): Record<string, number> {
  const dias: Record<string, number> = {}
  for (const [etapa, texto] of Object.entries(tabla)) {
    const n = Number(texto)
    if (texto.trim() !== '' && Number.isInteger(n) && n > 0) dias[etapa] = n
  }
  return dias
}

/**
 * Las etapas secuenciales del proyecto. Salen de la plantilla de su programa y
 * de las que usan sus sitios: un tracker importado trae su propia plantilla,
 * distinta de la del programa.
 */
function etapasDelProyecto(
  proyecto: Proyecto,
  programas: readonly Programa[],
  plantillas: readonly GateTemplate[],
  idsEnUso: ReadonlySet<string>,
): { codigo: string; nombre: string }[] {
  const programa = programas.find((p) => p.id === proyecto.programaId)
  const ids = new Set([...idsEnUso, ...(programa ? [programa.gateTemplateId] : [])])
  const vistas = new Map<string, string>()
  for (const plantilla of plantillas.filter((p) => ids.has(p.id))) {
    for (const g of [...plantilla.gates].sort((a, b) => a.orden - b.orden)) {
      if (!esParalela(g) && !vistas.has(g.codigo)) vistas.set(g.codigo, g.nombre)
    }
  }
  return [...vistas].map(([codigo, nombre]) => ({ codigo, nombre }))
}

/**
 * SLA de un proyecto: cuantos dias puede estar un sitio en cada etapa, y las
 * excepciones de cada celula. Una celda de celula vacia hereda el plazo
 * general de la etapa.
 */
export function EditorSla({
  proyecto,
  programas,
  plantillas,
  celulas,
  actor,
  onCerrar,
}: {
  proyecto: Proyecto
  programas: readonly Programa[]
  plantillas: readonly GateTemplate[]
  celulas: readonly Celula[]
  actor: Actor
  onCerrar: () => void
}) {
  const { seguimientos } = useDespliegue()
  const etapas = useMemo(() => {
    const enUso = new Set(
      seguimientos.filter((s) => s.proyectoId === proyecto.id).map((s) => s.gateTemplateId),
    )
    return etapasDelProyecto(proyecto, programas, plantillas, enUso)
  }, [seguimientos, proyecto, programas, plantillas])
  const activas = celulas.filter((c) => c.activa)

  const [general, setGeneral] = useState<Tabla>(() => aTexto(proyecto.sla?.dias))
  const [porCelula, setPorCelula] = useState<Record<string, Tabla>>(() =>
    Object.fromEntries(
      Object.entries(proyecto.sla?.porCelula ?? {}).map(([c, d]) => [c, aTexto(d)]),
    ),
  )
  const [habiles, setHabiles] = useState(proyecto.sla?.habiles ?? false)
  const [guardando, setGuardando] = useState(false)

  const guardar = () => {
    const dias = aDias(general)
    const excepciones: Record<string, Record<string, number>> = {}
    for (const [celula, tabla] of Object.entries(porCelula)) {
      const d = aDias(tabla)
      if (Object.keys(d).length > 0) excepciones[celula] = d
    }
    const vacio = Object.keys(dias).length === 0 && Object.keys(excepciones).length === 0
    setGuardando(true)
    guardarSlaProyecto(proyecto, vacio ? null : { dias, porCelula: excepciones, habiles }, actor)
      .then(() => {
        avisar.ok(`SLA de «${proyecto.nombre}» guardado`)
        onCerrar()
      })
      .catch((e) => avisar.error(`No se pudo guardar el SLA: ${mensajeDeError(e)}`))
      .finally(() => setGuardando(false))
  }

  const celdaNumero = (
    valor: string,
    onCambio: (v: string) => void,
    etiqueta: string,
    heredado?: string,
  ) => (
    <div className="w-16">
      <Entrada
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={valor}
        placeholder={heredado ?? '—'}
        aria-label={etiqueta}
        className="h-7 text-right tabular-nums"
        onChange={(e) => onCambio(e.target.value)}
      />
    </div>
  )

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`SLA de ${proyecto.nombre}`}
      descripcion="Días que puede estar un sitio en cada etapa, contados desde que cerró la anterior. Una célula sin valor usa el plazo general."
      ancho="xl"
      pie={
        <>
          <Boton onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando || etapas.length === 0}>
            {guardando ? 'Guardando…' : 'Guardar SLA'}
          </Boton>
        </>
      }
    >
      {etapas.length === 0 ? (
        <Aviso tono="info">
          Este proyecto todavía no tiene etapas: asígnale una plantilla a su programa o importa su
          tracker.
        </Aviso>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-texto-3">
                  <th className="py-1 pr-3 font-medium">Etapa</th>
                  <th className="px-2 py-1 text-right font-medium">General (días)</th>
                  {activas.map((c) => (
                    <th key={c.id} className="px-2 py-1 text-right font-medium whitespace-nowrap">
                      {c.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etapas.map((e) => (
                  <tr key={e.codigo} className="border-t border-borde">
                    <td className="py-1 pr-3">{e.nombre}</td>
                    <td className="px-2 py-1">
                      <span className="flex justify-end">
                        {celdaNumero(
                          general[e.codigo] ?? '',
                          (v) => setGeneral({ ...general, [e.codigo]: v }),
                          `SLA general de ${e.nombre}`,
                        )}
                      </span>
                    </td>
                    {activas.map((c) => (
                      <td key={c.id} className="px-2 py-1">
                        <span className="flex justify-end">
                          {celdaNumero(
                            porCelula[c.id]?.[e.codigo] ?? '',
                            (v) =>
                              setPorCelula({
                                ...porCelula,
                                [c.id]: { ...porCelula[c.id], [e.codigo]: v },
                              }),
                            `SLA de ${e.nombre} para ${c.nombre}`,
                            general[e.codigo] || undefined,
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Casilla
            etiqueta="Contar días hábiles"
            descripcion="De lunes a viernes. Sin marcar se cuentan días corridos."
            checked={habiles}
            onChange={(e) => setHabiles(e.target.checked)}
          />
        </div>
      )}
    </Dialogo>
  )
}
