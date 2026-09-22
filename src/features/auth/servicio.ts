/**
 * Punto unico de entrada de autenticacion para la UI.
 *
 * Existe para que agregar Microsoft (Entra ID) en Fase 3 sea agregar un metodo
 * aqui y un boton en la pantalla de login, sin tocar nada mas. La UI no importa
 * firebase/* directamente (hay una regla de ESLint que lo impide).
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
  usuariosDemo,
  validarCorreoCorporativo,
  type MetodoIngreso,
  type UsuarioDemo,
} from '@/data/autenticacion'
