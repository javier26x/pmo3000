/**
 * Ingreso con Microsoft 365 (Entra ID, tenant CLAROCHILE) via Firebase Auth.
 *
 * Firebase hace el intercambio OAuth; la app solo recibe al usuario. El token
 * de acceso de Microsoft que devuelve el popup NO se guarda: hoy nada lo usa.
 * Cuando la app hable con Graph, el lugar para obtenerlo es obtenerTokenGraph()
 * de abajo, y el resto de la app no tiene que enterarse de como se consigue.
 */
import { OAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth'
import { AJUSTES, auth } from '../firebase'
import { esDominioPermitido, textoDominios } from '@/domain/permisos/dominio'
import { ALCANCES_INGRESO } from './alcances'

export function hayIngresoMicrosoft(): boolean {
  return AJUSTES.tenantMicrosoft !== ''
}

function proveedor(): OAuthProvider {
  const p = new OAuthProvider('microsoft.com')
  for (const alcance of ALCANCES_INGRESO) p.addScope(alcance)
  p.setCustomParameters({ tenant: AJUSTES.tenantMicrosoft, prompt: 'select_account' })
  return p
}

/**
 * Ingresa con la cuenta de Microsoft 365. Solo cuentas @clarovtr.cl o
 * @claro.cl: se valida aca, al tiro, y otra vez en firestore.rules (que es lo
 * que cuenta). Que el registro de Azure sea de un solo inquilino es la tercera
 * barrera: una cuenta de otro directorio ni siquiera llega aca.
 */
export async function ingresarConMicrosoft(): Promise<User> {
  if (!hayIngresoMicrosoft()) throw new Error('El ingreso con Microsoft no está configurado')
  let usuario: User
  try {
    usuario = (await signInWithPopup(auth, proveedor())).user
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/account-exists-with-different-credential') {
      throw new Error(
        'Tu correo ya entró antes con otro método (enlace por correo o Google). ' +
          'Entra con ese método; un administrador puede unificarlo después.',
        { cause: e },
      )
    }
    throw e
  }

  const correo = usuario.email ?? ''
  if (!esDominioPermitido(correo, AJUSTES.dominiosPermitidos)) {
    await signOut(auth)
    throw new Error(
      `La cuenta ${correo || 'elegida'} no es de Claro. Con Microsoft 365 solo entran correos ${textoDominios(AJUSTES.dominiosPermitidos)}.`,
    )
  }
  return usuario
}

/**
 * Punto de extension para Graph API. Hoy no hay consentimiento de
 * administrador para los permisos de SharePoint, asi que no se implementa: la
 * migracion agregara aca la obtencion del token (con MSAL o reautenticando con
 * los alcances de ALCANCES_GRAPH_FUTUROS) y nada fuera de src/data/microsoft
 * cambia.
 */
export async function obtenerTokenGraph(): Promise<string> {
  throw new Error('Graph API todavía no está habilitado para PMO3000')
}
