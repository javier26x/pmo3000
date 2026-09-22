import { Dialogo } from '@/components/ui'
import { ATAJOS } from './atajos'

/** Hoja de atajos (tecla `?`). Se alimenta del mismo catálogo que los registra. */
export function AyudaAtajos({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const grupos = [...new Set(ATAJOS.map((a) => a.grupo))]

  return (
    <Dialogo
      abierto={abierta}
      onCerrar={onCerrar}
      titulo="Atajos de teclado"
      descripcion="Esta herramienta se puede usar entera sin soltar el teclado."
      ancho="lg"
    >
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {grupos.map((grupo) => (
          <section key={grupo}>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-texto-3 uppercase">
              {grupo}
            </h3>
            <dl className="flex flex-col gap-1">
              {ATAJOS.filter((a) => a.grupo === grupo).map((atajo) => (
                <div
                  key={atajo.descripcion}
                  className="flex items-center justify-between gap-3 rounded px-1 py-0.5 text-sm hover:bg-superficie-2"
                >
                  <dt className="min-w-0 truncate text-texto-2">{atajo.descripcion}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {atajo.teclas.map((tecla, i) => (
                      <span key={`${tecla}-${i}`} className="flex items-center gap-1">
                        {i > 0 && <span className="text-[10px] text-texto-3">luego</span>}
                        <kbd className="tecla">{tecla}</kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-4 border-t border-borde pt-3 text-xs text-texto-3">
        Los atajos no se activan mientras escribes en un campo. En macOS, ⌘ reemplaza a Ctrl.
      </p>
    </Dialogo>
  )
}
