# Ingreso con Microsoft 365 (cuenta de Office de Claro)

La pantalla de ingreso muestra **Continuar con Microsoft 365** cuando está
configurado. Entra la gente de Claro con su cuenta corporativa, sin contraseña
nueva.

## Qué permisos pide (solo lectura)

Solo **`User.Read`** de Microsoft Graph (delegado): nombre y correo de quien
inicia sesión. La app **no** lee correo, calendario, archivos ni contactos, y
no guarda el token de Microsoft. No se pide `offline_access`.

El rol dentro de PMO3000 es aparte: quien entra por primera vez queda como
**lector** (solo lectura), salvo que un administrador lo haya invitado con otro
rol desde Usuarios.

## Lo que tiene que hacer TI de Claro (una vez)

1. **Azure Portal → Microsoft Entra ID → Registros de aplicaciones → Nuevo
   registro**
   - Nombre: `PMO3000`
   - Tipos de cuenta: **Solo las cuentas de este directorio organizativo
     (inquilino único)**. Esto es lo que garantiza que solo entren cuentas de
     Claro; las reglas del servidor confían en ello.
   - URI de redirección (Web): `https://pmoclr.firebaseapp.com/__/auth/handler`
2. **Permisos de API**: dejar solo _Microsoft Graph → Delegados → `User.Read`_
   (viene por defecto). No agregar otros.
3. **Certificados y secretos → Nuevo secreto de cliente**. Copiar el valor.
4. Anotar el **Id. de aplicación (cliente)** y el **Id. de directorio
   (inquilino)**.

## Lo que se hace en Firebase

1. Consola de Firebase → proyecto `pmoclr` → **Authentication → Método de
   inicio de sesión → Agregar proveedor → Microsoft**.
2. Pegar el Id. de aplicación y el secreto de cliente. Guardar.
3. En `.env.production`, agregar el inquilino:

   ```
   VITE_MICROSOFT_TENANT=<Id. de directorio (inquilino)>
   ```

4. Desplegar: `npm run deploy`.

## Detalles

- Firebase suele marcar como no verificado el correo que llega desde
  Microsoft. Las reglas lo aceptan solo para cuentas `@clarovtr.cl` que
  entran con Microsoft (ver `correoConfiable()` en `firestore.rules`).
- Si una persona ya había entrado con el enlace por correo o con Google, el
  primer ingreso con Microsoft le avisa que use el método anterior (Firebase
  no mezcla métodos de un mismo correo sin que se vinculen).
