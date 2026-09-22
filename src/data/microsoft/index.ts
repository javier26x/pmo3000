/**
 * Integracion con Microsoft 365. La app entra por aca y no por firebase/auth
 * ni por Graph directamente, asi que cambiar como se habla con Microsoft
 * (correo a Power Automate hoy, Graph API manana) queda contenido en esta
 * carpeta:
 *
 * - identidad.ts: ingreso con Entra ID y, a futuro, el token de Graph.
 * - alcances.ts: los unicos permisos que se piden.
 * - carpetas.ts: carpetas de SharePoint detras de la interfaz ServicioCarpetas.
 */
export { ALCANCES_INGRESO } from './alcances'
export { hayIngresoMicrosoft, ingresarConMicrosoft } from './identidad'
export {
  crearServicioCarpetas,
  observarSolicitudesDeSitio,
  type SolicitudRegistrada,
  type ResultadoCarpeta,
  type ServicioCarpetas,
  type SolicitudCarpeta,
} from './carpetas'
