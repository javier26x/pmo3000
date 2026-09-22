/**
 * Punto único de entrada de autenticación para la interfaz.
 *
 * Existe para que agregar un proveedor más (Microsoft / Entra ID, en Fase 3) sea
 * agregar un método aquí y un botón en el login, sin tocar nada más. La interfaz
 * no importa `firebase/*` directamente: hay una regla de ESLint que lo impide.
 */
export {
  AJUSTES_AUTENTICACION as AJUSTES_UI,
  cerrarSesion,
  completarIngresoConEnlace,
  correoPendiente,
  dominioPermitido,
  enviarEnlaceIngreso,
  hayEnlaceEnUrl,
  ingresarComoUsuarioDemo,
  ingresarConGoogle,
  ingresarConMicrosoft,
  POLITICA,
  puedeEntrar,
  tomarAccesoDenegado,
  usuariosDemo,
  validarAcceso,
  type MetodoIngreso,
  type UsuarioDemo,
} from '@/data/autenticacion'
