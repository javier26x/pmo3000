# Integración con Microsoft 365

## Ingreso (Entra ID, tenant CLAROCHILE)

Firebase Auth con el proveedor Microsoft, restringido al tenant CLAROCHILE
(`a5603b60-3a2f-4d5d-9f2d-1ec213aa643e`, en `VITE_MICROSOFT_TENANT`).

**Permisos que se piden, y ningún otro** (`src/data/microsoft/alcances.ts`):
`openid`, `profile`, `email`, `offline_access` y `User.Read`. Son los que el
tenant deja aceptar a cada usuario sin aprobación de un administrador.

**No se piden** `Files.ReadWrite.All` ni `Sites.ReadWrite.All` (ni otros de
SharePoint u Outlook): requieren consentimiento de administrador, que aún no
está disponible, y con ellos el ingreso se bloquearía para todos.

**Quién entra:** solo correos `@clarovtr.cl` y `@claro.cl`, validado en tres
capas:

1. El registro de la app en Azure es de **inquilino único**: una cuenta de otro
   directorio no llega a la app.
2. El cliente (`src/data/microsoft/identidad.ts`) cierra la sesión si el correo
   no es de esos dominios.
3. Las reglas de Firestore (`esCorreoCorporativo()` y `correoConfiable()`) lo
   exigen del lado del servidor, que es lo que cuenta.

Quien entra sin invitación queda como **lector**.

## Carpetas de SharePoint

Por correo a Power Automate, sin Graph API: ver
[`power-automate-carpetas.md`](power-automate-carpetas.md). El buzón y la
plantilla del asunto se configuran en **Configuración → Carpetas de
SharePoint** (admin).

## Cómo está armada la capa (para migrar a Graph sin reescribir)

Todo lo que habla con Microsoft vive en `src/data/microsoft/`. La interfaz de
la app no importa `firebase/auth` ni Graph directamente.

| Archivo | Qué hace hoy | Qué cambia al migrar a Graph |
|---|---|---|
| `alcances.ts` | Los únicos permisos que se piden | Agregar `ALCANCES_GRAPH_FUTUROS` cuando haya consentimiento de administrador |
| `identidad.ts` | Ingreso con Entra ID vía Firebase | Implementar `obtenerTokenGraph()` (MSAL o reautenticación con más alcances) |
| `carpetas.ts` | `ServicioCarpetas` implementado por **correo** (`carpetasPorCorreo`) | Escribir `carpetasPorGraph` y devolverlo en `crearServicioCarpetas()` |

La pantalla (`src/features/sitios/SolicitarCarpeta.tsx`) solo conoce la
interfaz: si el resultado es `{ via: 'correo' }` abre el correo, y si es
`{ via: 'directa', url }` guarda la URL de la carpeta creada. Migrar no toca
la pantalla.

## Registro en Azure (hecho el 22-09-2026)

- App **PMO3000**, Id. de aplicación `fd161715-2a05-4a46-b63f-4c4c96732e5f`,
  inquilino único.
- URI de redirección: `https://pmoclr.firebaseapp.com/__/auth/handler`.
- Permisos declarados: Microsoft Graph `User.Read` (delegado).
- El secreto de cliente está en Firebase (Authentication → Método de acceso →
  Microsoft). Vence a los 2 años: renovarlo con
  `az ad app credential reset --id <appId> --years 2` y pegarlo en Firebase.

## Si aparece "Se necesita aprobación del administrador"

Con solo estos permisos, el tenant no debería pedirlo. Si igual aparece, la
política de consentimiento de CLAROCHILE exige además que la aplicación sea de
un **editor verificado**, o bien que un administrador la apruebe una vez:

```
https://login.microsoftonline.com/a5603b60-3a2f-4d5d-9f2d-1ec213aa643e/adminconsent?client_id=fd161715-2a05-4a46-b63f-4c4c96732e5f
```
