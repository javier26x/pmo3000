import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Mail, Radio, ShieldCheck, Zap } from 'lucide-react'
import {
  AJUSTES_UI,
  completarIngresoConEnlace,
  correoPendiente,
  dominioPermitido,
  enviarEnlaceIngreso,
  hayEnlaceEnUrl,
  ingresarComoUsuarioDemo,
  ingresarConGoogle,
  POLITICA,
  puedeEntrar,
  usuariosDemo,
  type UsuarioDemo,
} from '@/features/auth/servicio'
import { LogoGoogle } from './LogoGoogle'
import { Aviso, Boton, Campo, Entrada, Insignia, Cargando } from '@/components/ui'

import { NOMBRES_ROL, type Rol } from '@/domain/tipos/comunes'
import { mensajeDeError } from '@/app/avisos'
import { useSesion } from '@/hooks/useSesion'

type Estado = 'formulario' | 'enviando' | 'enviado' | 'completando'

/**
 * Si la persona llego desde el enlace del correo, el ingreso se completa solo.
 * Se resuelve en el estado inicial (no en un efecto) porque la respuesta depende
 * de la URL y del almacenamiento local, que ya estan disponibles al montar.
 */
function situacionInicial(): { estado: Estado; error: string | null } {
  if (!hayEnlaceEnUrl()) return { estado: 'formulario', error: null }
  if (!correoPendiente()) {
    return {
      estado: 'formulario',
      error:
        'Abriste el enlace en otro dispositivo o navegador. Escribe tu correo aqui para confirmar el ingreso.',
    }
  }
  return { estado: 'completando', error: null }
}

export function PaginaLogin() {
  const { autenticado, cargando: cargandoSesion } = useSesion()
  const ubicacion = useLocation()
  const [correo, setCorreo] = useState('')
  const [inicial] = useState(situacionInicial)
  const [estado, setEstado] = useState<Estado>(inicial.estado)
  const [error, setError] = useState<string | null>(inicial.error)
  const [demos, setDemos] = useState<UsuarioDemo[]>([])
  const [entrandoConGoogle, setEntrandoConGoogle] = useState(false)

  useEffect(() => {
    if (inicial.estado !== 'completando') return
    completarIngresoConEnlace().catch((e) => {
      setError(mensajeDeError(e))
      setEstado('formulario')
    })
  }, [inicial.estado])

  useEffect(() => {
    usuariosDemo()
      .then(setDemos)
      .catch(() => setDemos([]))
  }, [])

  // Ya hay sesion: volver a la pantalla desde la que se pidio el ingreso.
  if (autenticado) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde
    return <Navigate to={desde && desde !== '/login' ? desde : '/'} replace />
  }

  const dominio = dominioPermitido()
  const correoValido = puedeEntrar(correo)

  const entrarConGoogle = () => {
    setError(null)
    setEntrandoConGoogle(true)
    ingresarConGoogle()
      .catch((e) => {
        const texto = mensajeDeError(e)
        // Cancelar el popup no es un error que valga la pena mostrar.
        if (!/popup-closed-by-user|cancelled-popup-request/.test(texto)) {
          setError(
            /popup-blocked/.test(texto)
              ? 'El navegador bloqueó la ventana de Google. Permítela e inténtalo de nuevo.'
              : texto,
          )
        }
      })
      .finally(() => setEntrandoConGoogle(false))
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (hayEnlaceEnUrl()) {
      setEstado('completando')
      try {
        await completarIngresoConEnlace(correo)
      } catch (err) {
        setError(mensajeDeError(err))
        setEstado('formulario')
      }
      return
    }

    setEstado('enviando')
    try {
      await enviarEnlaceIngreso(correo)
      setEstado('enviado')
    } catch (err) {
      setError(mensajeDeError(err))
      setEstado('formulario')
    }
  }

  if (estado === 'completando' || (cargandoSesion && estado === 'enviando')) {
    return (
      <div className="grid min-h-dvh place-items-center bg-fondo">
        <Cargando texto="Confirmando tu ingreso…" />
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-fondo px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <Radio aria-hidden className="size-5 text-[var(--acento)]" />
          <div>
            <h1 className="text-xl">PMO3000</h1>
            <p className="text-sm text-texto-2">Gestion del despliegue de red movil</p>
          </div>
        </div>

        <div className="rounded-lg border border-borde bg-superficie p-4 shadow-[var(--sombra)]">
          {estado === 'enviado' ? (
            <div className="flex flex-col gap-3">
              <Aviso tono="ok" titulo="Revisa tu correo">
                Enviamos un enlace de ingreso a <strong>{correo}</strong>. Abrelo en este mismo
                dispositivo para entrar.
              </Aviso>
              {AJUSTES_UI.usarEmuladores && (
                <Aviso tono="info" titulo="Estas en modo emulador">
                  El correo no sale a internet. Copia el enlace desde la pestana Authentication del
                  Emulator UI (http://127.0.0.1:4000/auth), o usa el atajo de abajo.
                </Aviso>
              )}
              <Boton variante="secundario" onClick={() => setEstado('formulario')}>
                Usar otro correo
              </Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Boton
                variante="secundario"
                cargando={entrandoConGoogle}
                onClick={entrarConGoogle}
                icono={<LogoGoogle className="size-4" />}
                className="w-full"
              >
                Continuar con Google
              </Boton>

              <div className="flex items-center gap-2 text-xs text-texto-3">
                <span className="h-px flex-1 bg-borde" />o con tu correo
                <span className="h-px flex-1 bg-borde" />
              </div>

              <form onSubmit={enviar} className="flex flex-col gap-3">
                <Campo
                  etiqueta="Correo corporativo"
                  htmlFor="correo"
                  obligatorio
                  ayuda={`Correo @${dominio}`}
                  {...(error ? { error } : {})}
                >
                  <Entrada
                    id="correo"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={`nombre.apellido@${dominio}`}
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    aria-invalid={correo !== '' && !correoValido}
                    required
                  />
                </Campo>

                <Boton
                  type="submit"
                  variante="primario"
                  disabled={!correoValido}
                  cargando={estado === 'enviando'}
                  icono={<Mail aria-hidden className="size-4" />}
                  className="w-full"
                >
                  Enviarme el enlace de ingreso
                </Boton>
              </form>

              <p className="flex items-start gap-1.5 text-xs text-texto-3">
                <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Solo entran los correos <strong>@{dominio}</strong>
                {POLITICA.correosAdmin.length > 0 && ' y las cuentas autorizadas'}. Se valida
                también en las reglas del servidor, no solo aquí.
              </p>
            </div>
          )}
        </div>

        {AJUSTES_UI.usarEmuladores && demos.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-borde-fuerte bg-superficie-2 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Zap aria-hidden className="size-3.5 text-texto-2" />
              <p className="text-xs font-semibold text-texto-2">
                Atajo de desarrollo — entrar como
              </p>
              <Insignia tono="riesgo">solo emulador</Insignia>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {demos.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => {
                    setError(null)
                    ingresarComoUsuarioDemo(demo.email, demo.password).catch((e) =>
                      setError(mensajeDeError(e)),
                    )
                  }}
                  className="flex flex-col items-start rounded border border-borde bg-superficie px-2 py-1.5 text-left hover:border-borde-fuerte hover:bg-superficie-2"
                >
                  <span className="text-xs font-medium">{demo.nombre}</span>
                  <span className="text-[11px] text-texto-3">
                    {NOMBRES_ROL[demo.rol as Rol] ?? demo.rol}
                    {demo.proveedor ? ` · ${demo.proveedor}` : ''}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-texto-3">
              Estos usuarios los crea <code className="font-mono">npm run seed</code> y no existen
              en la nube.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
