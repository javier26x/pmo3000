# Carpetas de SharePoint sin Graph API (Fase 2)

La app no crea carpetas por sí sola: no tiene permisos de Graph API y conseguirlos
implica registrar una aplicación en Entra ID y pedir consentimiento de
administrador. La vía práctica es un **correo con formato fijo** que un flujo de
Power Automate lee y convierte en la estructura de carpetas.

> Este documento describe lo que se implementa en la **Fase 2**. El campo
> `carpetaUrl` del sitio ya existe en la Fase 1 y es editable a mano desde la
> ficha de sitio.

## Cómo funciona

```
La app arma un mailto: prellenado
        ↓
El usuario lo envía desde Outlook (queda en su bandeja de enviados)
        ↓
Power Automate detecta el correo en el buzón que configures
        ↓
Lee el asunto, crea la estructura en SharePoint
        ↓
Responde con la URL de la carpeta
        ↓
El usuario pega esa URL en el campo "Carpeta documental" del sitio
```

Que el correo salga desde Outlook del usuario tiene una ventaja: queda registro
en su bandeja de enviados de quién pidió qué y cuándo.

## Formato exacto del asunto

```
CREAR_CARPETA | <Programa> | <ID_Sitio> | <Nombre del sitio>
```

Ejemplo:

```
CREAR_CARPETA | Plan 200 sitios nuevos | RM-0421 | Cerro Azul 43
```

Reglas del formato, para que el flujo pueda parsearlo sin ambigüedad:

- Separador: espacio, barra vertical, espacio (`|`).
- Exactamente **cuatro** partes, en ese orden.
- La primera es siempre el literal `CREAR_CARPETA`.
- El nombre del sitio **no puede contener `|`**. La app lo reemplaza por `-` antes
  de armar el asunto.
- Sin tildes en el literal, para que ningún cliente de correo lo altere.

**Cuerpo del correo** (la app lo prellena; el flujo no lo necesita, es para que
quede legible en la bandeja):

```
Solicitud automática generada por PMO3000.

Programa:  Plan 200 sitios nuevos
Proyecto:  Plan 200 - Metropolitana
ID sitio:  RM-0421
Nombre:    Cerro Azul 43
Comuna:    Maipú
Región:    Metropolitana de Santiago
Solicitado por: Nombre Apellido (nombre.apellido@clarovtr.cl)
Fecha: 21-09-2026

No modifiques el asunto: el flujo de Power Automate lo usa para crear la carpeta.
```

## Estructura de carpetas sugerida

Una carpeta por sitio, y dentro una subcarpeta por gate. Así, el checklist de la
app y la carpeta documental se leen igual:

```
/<Programa>/<ID_Sitio> - <Nombre>/
├─ 00 General/                  Ficha del sitio, contactos, permisos generales
├─ 01 TSSR/                     Informe de survey, set fotográfico, croquis
├─ 02 FC/                       Acta de obra civil, medición de tierra, energía
├─ 03 RFI/                      Permiso municipal, accesos, cálculo estructural
├─ 04 Implementacion/           Configuración, VSWR, fotos de instalación
├─ 05 D+1/                      Reporte de KPI y alarmas del primer día
├─ 06 D+7/                      Reporte de KPI de la primera semana
├─ 07 SSV/                      Drive test, acta SSV firmada, inventario
└─ 99 Cierre/                   Carpeta final consolidada
```

Los números delante mantienen el orden en SharePoint, que ordena
alfabéticamente.

## Crear el flujo en Power Automate

Solo conectores estándar: Outlook 365 y SharePoint. No requiere licencia premium.

### 1. Disparador

**Outlook 365 → Cuando llega un correo electrónico nuevo (V3)**

- _Carpeta_: `Bandeja de entrada` (o una carpeta dedicada, ej. `PMO-Carpetas`).
- _Filtro de asunto_: `CREAR_CARPETA`
- _Solo con datos adjuntos_: No

> Recomendación: usa un buzón compartido (ej. `pmo.carpetas@clarovtr.cl`) y pon ese
> buzón como destinatario del `mailto:`. Así el flujo no depende de la cuenta
> personal de nadie.

### 2. Validar el asunto

**Control → Condición**

Expresión:

```
length(split(triggerOutputs()?['body/subject'], ' | '))
```

es igual a `4`.

En la rama **Si no**, responde al remitente avisando que el asunto está mal
formado y termina el flujo. Vale la pena: evita crear carpetas con nombres rotos.

### 3. Extraer las partes

**Datos → Inicializar variable** (una por cada parte, tipo Cadena):

| Variable      | Valor                                            |
| ------------- | ------------------------------------------------ |
| `Programa`    | `trim(split(triggerOutputs()?['body/subject'], ' | ')[1])` |
| `IdSitio`     | `trim(split(triggerOutputs()?['body/subject'], ' | ')[2])` |
| `NombreSitio` | `trim(split(triggerOutputs()?['body/subject'], ' | ')[3])` |

Y una más con el nombre de la carpeta:

| Variable        | Valor                                                           |
| --------------- | --------------------------------------------------------------- |
| `NombreCarpeta` | `concat(variables('IdSitio'), ' - ', variables('NombreSitio'))` |

### 4. Crear las carpetas

**SharePoint → Crear nueva carpeta**

- _Dirección del sitio_: el sitio de SharePoint de la PMO.
- _Lista o biblioteca_: `Documentos`.
- _Ruta de la carpeta_:
  `concat('/Despliegue/', variables('Programa'), '/', variables('NombreCarpeta'))`

Después, para las subcarpetas, usa **Aplicar a cada uno** sobre un arreglo:

```
createArray('00 General','01 TSSR','02 FC','03 RFI','04 Implementacion','05 D+1','06 D+7','07 SSV','99 Cierre')
```

y dentro, otro **Crear nueva carpeta** con la ruta:

```
concat('/Despliegue/', variables('Programa'), '/', variables('NombreCarpeta'), '/', items('Aplicar_a_cada_uno'))
```

> Activa la **concurrencia** del bucle (Configuración → Control de concurrencia)
> para que las nueve subcarpetas se creen en paralelo.

### 5. Responder con la URL

**Outlook 365 → Responder al correo electrónico (V3)**

- _Id del mensaje_: el del disparador.
- _Cuerpo_:

```
Carpeta creada para <IdSitio> - <NombreSitio>.

URL: <la propiedad "Vínculo para compartir" o "Ruta de acceso completa" que devuelve el paso Crear nueva carpeta>

Pega esta URL en el campo "Carpeta documental" de la ficha del sitio en PMO3000.
```

### 6. Manejo de errores

En el paso «Crear nueva carpeta», **Configurar ejecución después** → marca
también _ha fallado_, y agrega una acción de respuesta que avise del problema.
El caso más común es que la carpeta ya exista, que no es realmente un error:
conviene responder con la URL igual.

## Qué hará la app en la Fase 2

- Botón **«Preparar correo de carpeta»** en la ficha del sitio, que abre el
  cliente de correo con el `mailto:` ya armado (destinatario, asunto y cuerpo).
- Registro en la colección `solicitudesCarpeta` de qué se pidió, cuándo y quién,
  para poder ver qué sitios quedaron sin carpeta.
- Campo `carpetaUrl` en el sitio, editable a mano — **esto ya existe en la Fase 1**.
- Plantilla del asunto configurable en `config/app.asuntoCarpeta`, por si cambia
  el formato sin tener que tocar código.

## Límite conocido del `mailto:`

Los clientes de correo y los navegadores truncan los `mailto:` largos (el límite
práctico ronda los 2.000 caracteres, y algunos clientes de Windows cortan antes).
Por eso el cuerpo es corto y toda la información que el flujo necesita va en el
**asunto**. Si más adelante hiciera falta enviar más datos, la salida es que el
flujo consulte la app en vez de recibirlo todo por correo.
