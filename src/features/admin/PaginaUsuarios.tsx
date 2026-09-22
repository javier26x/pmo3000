import { useState } from 'react'
import { MailPlus, ShieldAlert, UserCog } from 'lucide-react'
import {
  Aviso,
  Boton,
  CabeceraPantalla,
  Campo,
  Cargando,
  Celda,
  Dialogo,
  Encabezado,
  EstadoVacio,
  Insignia,
  Selector,
  Entrada,
  Casilla,
} from '@/components/ui'
import { avisar, mensajeDeError } from '@/app/avisos'
import { actualizarUsuario } from '@/data/repos/usuarios'
import { formatearFechaHora } from '@/domain/fechas'
import { NOMBRES_ROL, ROLES, type Alcance, type Rol } from '@/domain/tipos/comunes'
import { alcanceVacio, normalizarAlcance, validarAlcance } from '@/domain/permisos/alcance'
import { esquemaUsuarioEditable, type Usuario } from '@/domain/tipos/usuario'
import { useActor } from '@/hooks/useSesion'
import { useCatalogos } from '@/hooks/useCatalogos'
import { useTituloPagina } from '@/hooks/useTituloPagina'
import { ChipsAlcance, EditorAlcance } from './EditorAlcance'
import { DialogoInvitar, ListaInvitaciones, useInvitaciones } from './Invitaciones'

const TONO_ROL: Record<Rol, 'acento' | 'info' | 'neutro' | 'riesgo'> = {
  admin: 'acento',
  jefe_celula: 'info',
  analista: 'neutro',
  contratista: 'riesgo',
  lector: 'neutro',
}

export function PaginaUsuarios() {
  const actor = useActor()
  const { usuarios, celulas, proveedores, nombreCelula, nombreProveedor, cargando } = useCatalogos()

  const [editando, setEditando] = useState<Usuario | null>(null)
  const [invitando, setInvitando] = useState(false)
  const invitaciones = useInvitaciones()
  useTituloPagina('Usuarios y roles')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('lector')
  const [celulaId, setCelulaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [activo, setActivo] = useState(true)
  const [alcance, setAlcance] = useState<Alcance>(alcanceVacio())
  const [error, setError] = useState<string | null>(null)
  const [errorAlcance, setErrorAlcance] = useState<string | null>(null)

  const abrir = (usuario: Usuario) => {
    setEditando(usuario)
    setNombre(usuario.nombre)
    setRol(usuario.rol)
    setCelulaId(usuario.celulaId ?? '')
    setProveedorId(usuario.proveedorId ?? '')
    setActivo(usuario.activo)
    setAlcance(usuario.alcance)
    setError(null)
    setErrorAlcance(null)
  }

  const guardar = () => {
    if (!editando) return
    const candidato = {
      nombre: nombre.trim(),
      rol,
      celulaId: celulaId || null,
      proveedorId: proveedorId || null,
      // Un admin nunca queda acotado: su alcance se guarda vacio.
      alcance: rol === 'admin' ? alcanceVacio() : normalizarAlcance(alcance),
      activo,
    }

    // El tope de Firestore se avisa junto al editor, antes que el resto.
    const problemaAlcance = validarAlcance(candidato.alcance)
    setErrorAlcance(problemaAlcance)
    if (problemaAlcance) return

    // El mismo esquema Zod del dominio: un contratista sin proveedor no pasa.
    const validado = esquemaUsuarioEditable.safeParse(candidato)
    if (!validado.success) {
      setError(validado.error.issues[0]?.message ?? 'Los datos no son validos')
      return
    }

    // Igual que en el resto de la app: el cambio ya se aplicó en la caché local,
    // así que no se espera al servidor para cerrar el diálogo.
    actualizarUsuario(editando, validado.data, actor).catch((e) => avisar.error(mensajeDeError(e)))
    avisar.ok(`Perfil de ${candidato.nombre} actualizado`)
    setEditando(null)
  }

  const seEditaASiMismo = editando?.id === actor.uid

  return (
    <>
      <CabeceraPantalla
        titulo="Usuarios y roles"
        descripcion="Invita a las personas por correo con su rol ya asignado. Quien entra sin invitación (solo @clarovtr.cl) queda como lector."
        acciones={
          <Boton
            variante="primario"
            onClick={() => setInvitando(true)}
            icono={<MailPlus aria-hidden className="size-4" />}
          >
            Invitar
          </Boton>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <Aviso tono="info" className="mb-3">
          Los usuarios no se borran: se desactivan. Asi su rastro en la auditoria sigue apuntando a
          alguien. Las reglas de Firestore ademas impiden que un administrador se quite su propio
          rol de admin, para no dejar la instalacion sin quien administre.
        </Aviso>

        <ListaInvitaciones
          invitaciones={invitaciones.filter((i) => i.estado !== 'aceptada')}
          actor={actor}
        />

        {cargando && usuarios.length === 0 ? (
          <Cargando texto="Cargando usuarios…" />
        ) : usuarios.length === 0 ? (
          <EstadoVacio
            icono={<UserCog aria-hidden className="size-8" />}
            titulo="Todavia no hay usuarios"
            descripcion="Los perfiles se crean en el primer ingreso de cada persona."
          />
        ) : (
          <div className="panel-scroll min-h-0 flex-1 overflow-auto rounded border border-borde bg-superficie">
            <table className="w-full border-collapse">
              <caption className="sr-only">Usuarios de la PMO con su rol y estado</caption>
              <thead>
                <tr>
                  <Encabezado>Nombre</Encabezado>
                  <Encabezado>Correo</Encabezado>
                  <Encabezado>Rol</Encabezado>
                  <Encabezado>Celula</Encabezado>
                  <Encabezado>Proveedor</Encabezado>
                  <Encabezado>Alcance</Encabezado>
                  <Encabezado>Estado</Encabezado>
                  <Encabezado>Ultimo acceso</Encabezado>
                  <Encabezado />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr
                    key={usuario.id}
                    style={{ height: 'var(--alto-fila)' }}
                    className="border-b border-borde last:border-0 hover:bg-superficie-2"
                  >
                    <Celda className="max-w-44 font-medium">{usuario.nombre}</Celda>
                    <Celda className="max-w-56 text-texto-2">{usuario.email}</Celda>
                    <Celda>
                      <Insignia tono={TONO_ROL[usuario.rol]}>{NOMBRES_ROL[usuario.rol]}</Insignia>
                    </Celda>
                    <Celda className="max-w-36 text-texto-2">
                      {nombreCelula(usuario.celulaId)}
                    </Celda>
                    <Celda className="max-w-36 text-texto-2">
                      {nombreProveedor(usuario.proveedorId)}
                    </Celda>
                    <Celda className="max-w-72">
                      {usuario.rol === 'admin' ? (
                        <span className="text-texto-3">Todo</span>
                      ) : (
                        <ChipsAlcance alcance={usuario.alcance} />
                      )}
                    </Celda>
                    <Celda>
                      {usuario.activo ? (
                        <Insignia tono="ok">Activo</Insignia>
                      ) : (
                        <Insignia tono="error">Desactivado</Insignia>
                      )}
                    </Celda>
                    <Celda className="text-texto-2 tabular-nums">
                      {formatearFechaHora(usuario.ultimoAcceso)}
                    </Celda>
                    <Celda alineacion="derecha">
                      <Boton tamano="sm" onClick={() => abrir(usuario)}>
                        Editar
                      </Boton>
                    </Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invitando && (
        <DialogoInvitar
          actor={actor}
          correosConCuenta={new Set(usuarios.map((u) => u.email))}
          onCerrar={() => setInvitando(false)}
        />
      )}

      <Dialogo
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={`Editar ${editando?.nombre ?? ''}`}
        descripcion={editando?.email}
        ancho="lg"
        pie={
          <>
            <Boton onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardar}>
              Guardar cambios
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {seEditaASiMismo && (
            <Aviso tono="riesgo" titulo="Estas editando tu propio perfil">
              No puedes quitarte el rol de administrador: las reglas del servidor lo rechazan para
              que la instalacion no quede sin administrador.
            </Aviso>
          )}

          <Campo etiqueta="Nombre" htmlFor="u-nombre" obligatorio>
            <Entrada id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>

          <Campo etiqueta="Rol" htmlFor="u-rol" obligatorio>
            <Selector id="u-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRES_ROL[r]}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Celula"
            htmlFor="u-celula"
            ayuda="Define que columna del kanban por celula le corresponde."
          >
            <Selector id="u-celula" value={celulaId} onChange={(e) => setCelulaId(e.target.value)}>
              <option value="">Sin celula</option>
              {celulas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Proveedor"
            htmlFor="u-proveedor"
            obligatorio={rol === 'contratista'}
            ayuda={
              rol === 'contratista'
                ? 'Obligatorio: acota que sitios puede ver. Sin proveedor, las reglas no pueden limitarlo.'
                : 'Solo aplica a contratistas.'
            }
            {...(error ? { error } : {})}
          >
            <Selector
              id="u-proveedor"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              aria-invalid={rol === 'contratista' && !proveedorId}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>

          {rol !== 'admin' && (
            <Campo
              etiqueta="Alcance"
              ayuda="Qué parte del despliegue ve y edita. Lo imponen las reglas del servidor, no solo la pantalla."
              {...(errorAlcance ? { error: errorAlcance } : {})}
            >
              <EditorAlcance valor={alcance} onCambio={setAlcance} />
            </Campo>
          )}

          <Casilla
            etiqueta="Cuenta activa"
            descripcion="Una cuenta desactivada no puede leer ni escribir nada."
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />

          {rol === 'admin' && (
            <p className="flex items-start gap-1.5 text-xs text-texto-3">
              <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Un administrador puede cambiar roles, editar la plantilla de gates y borrar sitios.
            </p>
          )}
        </div>
      </Dialogo>
    </>
  )
}
