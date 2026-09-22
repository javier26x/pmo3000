/**
 * Permisos que PMO3000 pide a Microsoft 365. Unico lugar donde se definen.
 *
 * Son los que el tenant CLAROCHILE deja aceptar a cada usuario sin aprobacion
 * de un administrador:
 *
 * - openid, profile, email: identidad (quien es, su nombre y correo).
 * - offline_access: que Microsoft pueda renovar la sesion sin volver a pedir
 *   la clave. La app no guarda tokens hoy; queda para cuando use Graph.
 * - User.Read: leer el perfil propio en Microsoft Graph.
 *
 * NO agregar Files.ReadWrite.All ni Sites.ReadWrite.All (u otros de SharePoint
 * u Outlook): requieren consentimiento de administrador, que aun no esta
 * disponible, y con ellos el ingreso se bloquearia para todos con "Se necesita
 * aprobacion del administrador". Las carpetas de SharePoint van por correo a
 * Power Automate (ver ./carpetas.ts y docs/power-automate-carpetas.md).
 */
export const ALCANCES_INGRESO = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
] as const

/**
 * Los que haran falta para crear carpetas con Graph API cuando haya
 * consentimiento de administrador. Documentados aca para que la migracion sepa
 * que pedir; hoy NO se solicitan.
 */
export const ALCANCES_GRAPH_FUTUROS = ['Sites.ReadWrite.All'] as const
