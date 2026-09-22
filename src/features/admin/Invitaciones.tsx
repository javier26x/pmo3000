import { useEffect, useState } from 'react'
import { MailPlus, RotateCw, Ban } from 'lucide-react'
import {
  Aviso,
  Boton,
  Campo,
  Dialogo,
  Entrada,
  Insignia,
  Selector,
  type TonoInsignia,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import {
  invitar,
  observarInvitaciones,
  reenviarInvitacion,
  revocarInvitacion,
} from '@/data/repos/invitaciones'
import { alcanceVacio, normalizarAlcance, validarAlcance } from '@/domain/permisos/alcance'
import { formatearFechaHora } from '@/domain/fechas'
import { NOMBRES_ROL, ROLES, type Actor, type Alcance, type Rol } from '@/domain/tipos/comunes'
import type { EstadoInvitacion, Invitacion } from '@/domain/tipos/invitacion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { EditorAlcance } from './EditorAlcance'

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ESTADO: Record<EstadoInvitacion, { texto: string; tono: TonoInsignia }> = {
  pendiente: { texto: 'Pendiente', tono: 'riesgo' },
  aceptada: { texto: 'Aceptada', tono: 'ok' },
  revocada: { texto: 'Revocada', tono: 'neutro' },
}

/** Invitaciones del admin: se suscribe solo cuando la pantalla esta abierta. */
export function useInvitaciones(): Invitacion[] {
  const [lista, setLista] = useState<Invitacion[]>([])
  useEffect(() => observarInvitaciones(setLista, (e) => avisar.error(mensajeDeError(e))), [])
  return lista
}

/**
 * Invitar a una persona por correo, de cualquier dominio. Su perfil nace con
 * el rol, la celula, el proveedor y el alcance que se eligen aca, y recibe en
 * su correo el enlace para entrar.
 */
export function DialogoInvitar({
  actor,
  correosConCuenta,
  onCerrar,
}: {
  actor: Actor
  /** Correos que ya tienen perfil: a esos no se los invita, se los edita. */
  correosConCuenta: ReadonlySet<string>
  onCerrar: () => void
}) {
  const { celulas, proveedores } = useCatalogos()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('analista')
  const [celulaId, setCelulaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [alcance, setAlcance] = useState<Alcance>(alcanceVacio())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const correo = email.trim().toLowerCase()
  const yaTieneCuenta = correosConCuenta.has(correo)

  const enviar = () => {
    setError(null)
    if (!CORREO_VALIDO.test(correo)) return setError('Ese correo no parece válido.')
    if (yaTieneCuenta) return setError('Esa persona ya tiene cuenta: edítala en la tabla.')
    if (rol === 'contratista' && !proveedorId) {
      return setError('Un contratista necesita un proveedor: es lo que acota qué sitios ve.')
    }
    const problema = rol === 'admin' ? null : validarAlcance(normalizarAlcance(alcance))
    if (problema) return setError(problema)

    setEnviando(true)
    invitar(
      {
        email: correo,
        nombre,
        rol,
        celulaId: celulaId || null,
        proveedorId: proveedorId || null,
        alcance,
      },
      actor,
    )
      .then(() => {
        avisar.ok(`Invitación enviada a ${correo}`)
        onCerrar()
      })
      .catch((e) => setError(`No se pudo invitar: ${mensajeDeError(e)}`))
      .finally(() => setEnviando(false))
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Invitar a una persona"
      descripcion="Recibe en su correo un enlace para entrar. Su perfil nace con lo que elijas aquí."
      ancho="lg"
      pie={
        <>
          <Boton onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={enviar}
            cargando={enviando}
            icono={<MailPlus aria-hidden className="size-4" />}
          >
            Enviar invitación
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Correo" htmlFor="inv-correo" obligatorio>
            <Entrada
              id="inv-correo"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nombre@empresa.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Nombre" htmlFor="inv-nombre" ayuda="Opcional: si no, el de su cuenta.">
            <Entrada id="inv-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Rol" htmlFor="inv-rol" obligatorio>
            <Selector id="inv-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRES_ROL[r]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Célula" htmlFor="inv-celula">
            <Selector
              id="inv-celula"
              value={celulaId}
              onChange={(e) => setCelulaId(e.target.value)}
            >
              <option value="">Sin célula</option>
              {celulas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Proveedor" htmlFor="inv-prov" obligatorio={rol === 'contratista'}>
            <Selector
              id="inv-prov"
              value={proveedorId}
              disabled={rol !== 'contratista'}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">{rol === 'contratista' ? 'Elegir…' : 'Solo contratistas'}</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>

        {rol !== 'admin' && (
          <Campo
            etiqueta="Alcance"
            ayuda="Qué parte del despliegue verá. Sin marcar nada, ve todo lo que su rol permite."
          >
            <EditorAlcance valor={alcance} onCambio={setAlcance} />
          </Campo>
        )}

        <Aviso tono="info">
          Un correo de otro dominio (por ejemplo, de un contratista) solo puede entrar mientras su
          invitación esté vigente. Revocarla le quita el acceso.
        </Aviso>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Dialogo>
  )
}

/** Invitaciones enviadas, con su estado. Se reenvian o se revocan de a una. */
export function ListaInvitaciones({
  invitaciones,
  actor,
}: {
  invitaciones: readonly Invitacion[]
  actor: Actor
}) {
  const { nombreUsuario, nombreProveedor } = useCatalogos()
  const [ocupada, setOcupada] = useState<string | null>(null)

  if (invitaciones.length === 0) return null

  const accion = (inv: Invitacion, hacer: () => Promise<void>, ok: string) => {
    setOcupada(inv.id)
    hacer()
      .then(() => avisar.ok(ok))
      .catch((e) => avisar.error(mensajeDeError(e)))
      .finally(() => setOcupada(null))
  }

  return (
    <section
      aria-label="Invitaciones"
      className="mb-3 overflow-hidden rounded border border-borde bg-superficie"
    >
      <h2 className="border-b border-borde px-3 py-2 text-xs font-semibold text-texto-2">
        Invitaciones
      </h2>
      <ul className="divide-y divide-borde">
        {invitaciones.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="min-w-48 flex-1">
              <span className="font-medium">{inv.nombre || inv.email}</span>
              {inv.nombre && <span className="ml-2 text-xs text-texto-3">{inv.email}</span>}
            </span>
            <Insignia tono="neutro">{NOMBRES_ROL[inv.rol]}</Insignia>
            {inv.proveedorId && (
              <span className="text-xs text-texto-2">{nombreProveedor(inv.proveedorId)}</span>
            )}
            <Insignia tono={ESTADO[inv.estado].tono}>{ESTADO[inv.estado].texto}</Insignia>
            <span className="text-xs text-texto-3">
              {nombreUsuario(inv.invitadoPor)} · {formatearFechaHora(inv.invitadoEn)}
            </span>
            {inv.estado !== 'revocada' && (
              <span className="flex gap-1">
                {inv.estado === 'pendiente' && (
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    disabled={ocupada === inv.id}
                    onClick={() =>
                      accion(inv, () => reenviarInvitacion(inv), `Enlace reenviado a ${inv.email}`)
                    }
                    icono={<RotateCw aria-hidden className="size-3.5" />}
                  >
                    Reenviar
                  </Boton>
                )}
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  disabled={ocupada === inv.id}
                  onClick={() =>
                    accion(
                      inv,
                      () => revocarInvitacion(inv, actor),
                      `Invitación de ${inv.email} revocada`,
                    )
                  }
                  icono={<Ban aria-hidden className="size-3.5" />}
                >
                  Revocar
                </Boton>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
