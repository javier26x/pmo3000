# Importación del maestro de sitios

Acepta `.xlsx`, `.xlsm`, `.xls` y `.csv`, hasta 25 MB. La **primera fila debe ser
la cabecera**.

Nada se escribe en Firestore hasta que confirmas la vista previa.

## Los cuatro pasos

1. **Archivo** — se arrastra o se elige. Si el libro tiene varias hojas, se
   puede cambiar de hoja.
2. **Mapeo de columnas** — se autodetecta por alias y se puede corregir a mano.
   Aquí también se elige el proyecto por defecto y la prioridad inicial.
3. **Vista previa** — valida fila por fila, detecta duplicados y muestra el
   resumen. Hay un filtro «Ver solo filas con problemas».
4. **Resultado** — cuántos sitios y seguimientos se escribieron, y qué quedó
   fuera.

## Columnas

| Campo           | Obligatorio | Alias que reconoce                                       |
| --------------- | ----------- | -------------------------------------------------------- |
| ID de sitio     | sí          | id, id sitio, sitio, código sitio, código, site id, site |
| Nombre          | sí          | nombre, nombre sitio, site name, descripción, name       |
| Región          | sí          | región, región administrativa, zona                      |
| Comuna          | sí          | comuna, ciudad, localidad                                |
| Latitud         | sí          | lat, latitud, latitude, y                                |
| Longitud        | sí          | lon, lng, long, longitud, longitude, x                   |
| Dirección       | no          | dirección, domicilio, calle, address                     |
| Tecnologías     | no          | tecnologías, tecnología, tech, banda, bandas             |
| Tipo de sitio   | no          | tipo sitio, tipo, tipo estructura, site type             |
| Programa        | no          | programa, proyecto, plan, program, iniciativa            |
| Proveedor       | no          | proveedor, contratista, empresa, vendor, supplier        |
| Fecha de inicio | no          | fecha inicio, inicio, fecha plan, start date, fecha      |

La detección ignora mayúsculas, acentos y símbolos: `ID Sitio`, `id_sitio` y
`IDSITIO` son lo mismo. Si no hay coincidencia exacta con un alias, busca por
contención, de modo que `Latitud (WGS84)` también se reconoce. Cada columna del
archivo se usa una sola vez.

## Qué hace con lo que lee

**Números.** Acepta coma o punto decimal (`-33,4372` y `-33.4372`), separadores
de miles y el signo menos tipográfico que a veces mete Excel (`−33,4372`).

**Tecnologías.** Se separan por coma, punto y coma, barra o pipe: `4G/5G` y
`4G; 5G` dan lo mismo.

**Fechas.** Entiende el formato chileno (`09-03-2026`, `9/3/2026`, `09.03.26`),
el ISO (`2026-03-09`) y el número de serie de Excel. Un año de dos dígitos se
interpreta como `20xx`.

**Programa.** Si la fila trae programa y el nombre coincide (sin distinguir
mayúsculas) con un programa existente, el sitio se incorpora al seguimiento de
ese programa y se le crean los gates según la plantilla. Si no coincide, el
sitio entra al maestro **sin** seguimiento y el nombre aparece en el resultado
como «programa no encontrado».

**Proveedor.** Igual: si el nombre coincide, se asigna; si no, el sitio queda sin
proveedor y el nombre se reporta.

**Fecha de inicio.** Es el punto de partida para encadenar las fechas plan de
cada gate, sumando el SLA de la plantilla.

## Validación

**Errores** (la fila no se importa):

- falta ID, nombre, región o comuna;
- latitud o longitud vacías, no numéricas o fuera de rango;
- el ID contiene `/` (no es válido como id de documento) o pasa de 120 caracteres;
- el ID ya apareció antes en el mismo archivo.

**Avisos** (la fila sí se importa):

- coordenada válida pero fuera de Chile — y si al invertir latitud y longitud sí
  cae dentro, lo dice: es el error de digitación más común;
- fecha que no se pudo interpretar: el sitio se importa sin fecha de inicio.

## Duplicados

- **Dentro del archivo**: se importa la primera aparición y las siguientes se
  marcan con la fila donde ya apareció.
- **Contra el maestro**: las filas cuyo ID ya existe se marcan como _Actualiza_.
  No duplican nada: el id del documento es el ID del sitio.

Reimportar la misma planilla es seguro. El id del seguimiento también es
determinista (`proyectoId__sitioId`) y se escribe con `merge`, así que una
reimportación actualiza los datos del sitio **sin pisar el avance de sus gates**.

## Cómo escribe

Firestore permite 500 operaciones por lote. Como cada fila puede escribir dos
documentos (el sitio y su seguimiento), los lotes se arman por **operaciones**
(450) y no por filas, con barra de progreso.

Si un lote falla, el proceso se detiene y reporta hasta dónde alcanzó. Lo ya
escrito queda guardado y volver a correr la importación es seguro.

De toda la importación se escribe **un** evento de auditoría con el resumen, no
uno por fila.

Mientras se importa, la app suelta las suscripciones en vivo al maestro: con
miles de sitios, cada lote confirmado empujaría miles de documentos por los
listeners y dejaría el navegador pegado.

## Archivo de prueba

`npm run seed` genera en `datos-ejemplo/` una planilla de 4.500 filas en `.csv` y
`.xlsx`, con coma decimal (como sale de Excel en Chile) y cuatro filas
defectuosas a propósito: un duplicado, una sin ID, una con coordenada no
numérica y una con coordenada fuera de Chile.

## Rendimiento medido

Contra el emulador, con la planilla de 4.500 filas:

| Etapa                                     | Tiempo |
| ----------------------------------------- | ------ |
| Lectura del `.xlsx`                       | ~2 s   |
| Validación y detección de duplicados      | ~3 s   |
| Escritura en Firestore (9.000 documentos) | ~2 min |

La detección de duplicados lee la colección `sitios` completa (~4.500 lecturas,
holgado dentro de la cuota diaria gratuita de 50.000). Si algún día molesta, se
optimiza con un documento índice de IDs; se dejó así porque no puede
desincronizarse.
